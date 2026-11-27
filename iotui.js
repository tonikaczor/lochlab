'use strict';
/* Tonfunk Industrie-4.0-Lab: Oberfläche (Lab-Kennung 'iot').
   ALLE Zahlen sind ÜBUNGSWERTE für die Ausbildung. Frei erfundene Firma "Modellbetrieb", keine Hersteller, keine Produktnamen.
   Reiter: Datenkette (Intervall, Sensoren, Mittelwert: Datenmengen), MQTT (Geräte senden, Abonnenten mit Filtern), Zustand (Verlauf, Grenzwert, Trend),
           Aufgaben, Trainer, Hilfe.
   Module: iotcore.js (IOT_CORE), iotdata.js (IOT_DATA, IOT_TASKS), iotviz.js (IOT_VIZ, vor dieser Datei geladen).
   Speicher (Präfix lm4.iot.): tab, dk, mq (nur die Filter), zu, done ({id:true}), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus.
   Aufruf: iotlab.html?aufgabe=iot1 öffnet die Aufgabe. */
(function (root) {
  const C = root.IOT_CORE, D = root.IOT_DATA, V = root.IOT_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.iot.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Industrie-4.0-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">iotcore.js, iotdata.js oder iotviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['dk', '🔗', 'Datenkette'], ['mq', '📨', 'MQTT'], ['zu', '📈', 'Zustand'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['help', '📘', 'Hilfe']];
  const TS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60], NS = [1, 5, 10, 50, 100, 500, 1000], BS = [2, 4, 8], HS = [0, 20, 50], AVS = [1, 10, 60], KS = [1, 3, 5];
  const DEV = [{ name: 'Ofen', topic: 'halle1/linie2/temperatur', u: 't' }, { name: 'Presse', topic: 'halle1/linie2/druck', u: 'd' }, { name: 'Kühler', topic: 'halle1/linie3/temperatur', u: 't' }, { name: 'Lager', topic: 'halle2/lager/feuchte', u: 'f' }];
  const SUBN = ['Dashboard', 'Wartung', 'Alarm'], SUBF = ['halle1/+/temperatur', 'halle1/#', 'halle2/lager/feuchte'];
  const QOSTXT = ['QoS 0: höchstens einmal, ohne Bestätigung.', 'QoS 1: mindestens einmal, mit Bestätigung (Duplikate möglich).', 'QoS 2: genau einmal, mit mehrstufigem Austausch.'];
  const S = {
    tab: lsGet('tab', 'dk'),
    dk: Object.assign({ ti: 3, ni: 4, b: 4, h: 20, av: 10 }, lsGet('dk', {})),
    mq: { f: lsGet('mq', SUBF), q: 0, r: 0, ret: {}, log: [], last: null, ptopic: 'halle2/lager/temperatur', ppay: '21 °C' },
    zu: Object.assign({ kind: 'temp', seed: 1, day: 40, limit: 75, k: 3 }, lsGet('zu', {})),
    task: null, tq: null, tAns: {}, tRes: null, tFehl: {},
    tr: { q: null, ans: {}, res: null, level: 0 },
    rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {}))
  };
  /* Gespeicherte Zustände prüfen */
  if (!(Number.isInteger(S.dk.ti) && S.dk.ti >= 0 && S.dk.ti < TS.length)) S.dk.ti = 3;
  if (!(Number.isInteger(S.dk.ni) && S.dk.ni >= 0 && S.dk.ni < NS.length)) S.dk.ni = 4;
  if (!BS.includes(S.dk.b)) S.dk.b = 4;
  if (!HS.includes(S.dk.h)) S.dk.h = 20;
  if (!AVS.includes(S.dk.av)) S.dk.av = 10;
  if (!Array.isArray(S.mq.f) || S.mq.f.length !== 3 || S.mq.f.some(x => typeof x !== 'string')) S.mq.f = SUBF.slice();
  if (!C.KINDS[S.zu.kind]) S.zu.kind = 'temp';
  if (!(Number.isInteger(S.zu.seed) && S.zu.seed >= 1)) S.zu.seed = 1;
  if (!(Number.isInteger(S.zu.day) && S.zu.day >= C.TREND_W - 1 && S.zu.day < C.DAYS)) S.zu.day = 40;
  if (!KS.includes(S.zu.k)) S.zu.k = 3;
  if (!(S.zu.limit >= C.KINDS[S.zu.kind].lmin && S.zu.limit <= C.KINDS[S.zu.kind].lmax)) S.zu.limit = C.KINDS[S.zu.kind].limit;
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + ' = ' : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const UEB = 'Alle Zahlen in diesem Lab (Intervalle, Datenmengen, Grenzwerte, Kurven) sind Übungswerte. Maßgebend sind immer die Datenblätter, die Normen und die Regeln deines Betriebs.';
  const ueb = () => `<p class="hint2" style="margin:10px 0 0">⚠ ${esc(UEB)}</p>`;
  const seg = (attr, opts, cur) => `<div class="seg">${opts.map(o => `<button ${attr}="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div>`;
  const lbl = t => `<span style="font-size:14px;color:var(--mute)">${esc(t)}</span>`;
  const stepsBox = (st, kopf) => st && st.length ? `<div class="steps"><b>${kopf || 'So gehst du vor'}</b><ol>${st.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '';
  const fT = t => (t < 1 ? f(t * 1000, 0) + ' ms' : f(t, 0) + ' s');
  const setOn = (root_, attr, val) => $$('[' + attr + ']', root_).forEach(b => b.classList.toggle('on', String(b.getAttribute(attr)) === String(val)));

  /* ============================================================ Datenkette */
  function renderDk() {
    const d = S.dk;
    $('#dkView').innerHTML = `<div class="card pl"><h4>Vom Sensor zur Cloud</h4>
      <label class="f"><span>Abtastintervall: <b data-dv="ti"></b></span><input type="range" data-dr="ti" min="0" max="${TS.length - 1}" step="1" value="${d.ti}" aria-label="Abtastintervall"></label>
      <label class="f"><span>Zahl der Sensoren: <b data-dv="ni"></b></span><input type="range" data-dr="ni" min="0" max="${NS.length - 1}" step="1" value="${d.ni}" aria-label="Zahl der Sensoren"></label>
      <div class="ctl">${lbl('Byte je Wert')}${seg('data-sb', BS.map(x => [x, String(x)]), d.b)}</div>
      <div class="ctl">${lbl('Kopf je Nachricht (Topic, Protokoll)')}${seg('data-sh', HS.map(x => [x, x + ' Byte']), d.h)}</div>
      <div class="ctl">${lbl('Mittelwert im Gateway aus')}${seg('data-sa', AVS.map(x => [x, x === 1 ? 'keiner' : x + ' Werten']), d.av)}</div>
      <div class="vzbox" id="dkHost"></div><div id="dkOut"></div></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Stelle das Intervall auf 1 s und die Zahl der Sensoren auf 100. Lies die Datenmenge je Tag.', 'Verkürze das Intervall: Die Datenleitungen im Bild werden dicker und fließen schneller.', 'Schalte den Mittelwert im Gateway ein und sieh dir an, wie sich die Leitung zur Cloud verändert.', 'Vergleiche den Kopf je Nachricht von 0 und 50 Byte bei kleinen Werten: Der Nutzdatenanteil sinkt stark.'], 'Was du tun kannst')}</div>`;
    updateDk();
  }
  function updateDk() {
    const d = S.dk, p = { t: TS[d.ti], n: NS[d.ni], b: d.b, h: d.h, av: d.av }, c = C.chain(p);
    $$('[data-dv]', $('#dkView')).forEach(s => { s.textContent = s.dataset.dv === 'ti' ? fT(p.t) : f(p.n, 0); });
    setOn($('#dkView'), 'data-sb', d.b); setOn($('#dkView'), 'data-sh', d.h); setOn($('#dkView'), 'data-sa', d.av);
    $('#dkHost').innerHTML = V.dkSvg(p);
    $('#dkOut').innerHTML = box('Messwerte an einem Tag', f(p.n, 0) + ' · 86.400 s / ' + f(p.t, 1) + ' s', f(c.rawDay, 0) + ' Werte')
      + box('Rohdaten im Maschinennetz', f(p.n, 0) + ' · ' + p.b + ' Byte / ' + f(p.t, 1) + ' s · 8', C.fmtRate(c.rawBits))
      + box('Rohdaten je Tag', f(c.rawDay, 0) + ' · ' + p.b + ' Byte', C.fmtBytes(c.rawBytesDay))
      + box('Datenrate zur Cloud', f(c.outMsgS, 2) + ' Nachrichten/s · ' + (p.b + p.h) + ' Byte · 8', C.fmtRate(c.outBits), 'ok')
      + box('Gespeichert je Tag in der Cloud', '', C.fmtBytes(c.outBytesDay), 'ok')
      + box('Speicher für 30 Tage / 1 Jahr', '', C.fmtBytes(c.store30) + ' / ' + C.fmtBytes(c.store365))
      + (p.h > 0 ? box('Anteil Nutzdaten je Nachricht', p.b + ' / (' + p.b + ' + ' + p.h + ')', f(c.share, 1) + ' %') : '')
      + (p.av === 1 && c.rawBits > 100000 ? note('Mehr als 100 kbit/s ungemittelt in die Cloud: Ein Mittelwert im Gateway würde hier viel Datenmenge sparen.') : '');
  }
  const dv = $('#dkView');
  dv.addEventListener('input', e => { const k = e.target.dataset.dr; if (!k) return; S.dk[k] = +e.target.value; lsSet('dk', S.dk); updateDk(); });
  dv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.sb) S.dk.b = +d.sb; else if (d.sh) S.dk.h = +d.sh; else if (d.sa) S.dk.av = +d.sa; else return;
    lsSet('dk', S.dk); updateDk();
  });

  /* ============================================================ MQTT */
  const topicFehler = t => !t ? 'Das Topic fehlt.' : /[+#]/.test(t) ? 'Die Platzhalter + und # gibt es nur beim Abonnieren, nicht beim Senden.' : /\s/.test(t) ? 'Im Topic sind keine Leerzeichen erlaubt.' : !C.validTopic(t) ? 'Jede Ebene braucht einen Namen (kein // und kein Schrägstrich am Anfang oder Ende).' : '';
  const filterFehler = s => !s ? 'Der Filter fehlt.' : /\s/.test(s) ? 'Im Filter sind keine Leerzeichen erlaubt.' : s.split('/').some((x, i, a) => x === '#' && i !== a.length - 1) ? 'Das # darf nur ganz am Ende stehen.' : s.split('/').some(x => x.length > 1 && /[+#]/.test(x)) ? 'Das + und das # ersetzen immer eine ganze Ebene.' : !C.validFilter(s) ? 'Jede Ebene braucht einen Namen.' : '';
  const payOf = u => u === 't' ? C.ri(R0, 68, 92) + ' °C' : u === 'd' ? f(C.ri(R0, 40, 70) / 10, 1) + ' bar' : C.ri(R0, 35, 65) + ' %';
  function renderMq() {
    const m = S.mq;
    $('#mqView').innerHTML = `<div class="card pl"><h4>Geräte senden (publish)</h4>
      ${DEV.map((v, i) => `<div class="dev"><div class="grow"><b>${esc(v.name)}</b><code>${esc(v.topic)}</code></div><button class="btn" data-mp="${i}">Senden</button></div>`).join('')}
      <div class="dev"><div class="grow"><b>Eigene Nachricht</b>
        <label class="f"><span>Topic</span><input data-mt="topic" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(m.ptopic)}"></label>
        <label class="f"><span>Inhalt</span><input data-mt="pay" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(m.ppay)}"></label></div><button class="btn" data-mp="${DEV.length}">Senden</button></div>
      <div class="ctl">${lbl('Zustellung')}${seg('data-mq', [[0, 'QoS 0'], [1, 'QoS 1'], [2, 'QoS 2']], m.q)}</div><p class="hint2" id="mqQ" style="margin:0 0 6px"></p>
      <div class="ctl">${lbl('Retain')}${seg('data-mr', [[0, 'aus'], [1, 'an']], m.r)}</div>
      <div class="vzbox" id="mqHost"></div></div>
      <div class="card pl"><h4>Abonnenten (subscribe)</h4>${SUBN.map((n, i) => `<label class="f"><span>${esc(n)}: Filter mit + und #</span><input data-mf="${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(m.f[i])}"></label><div class="hint2" data-mfm="${i}" style="margin:-6px 0 8px"></div>`).join('')}</div>
      <div class="card pl"><h4>Protokoll des Brokers</h4><ul class="mqlog" id="mqLog"></ul></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Sende die Messung vom Ofen. Sieh nach, welche Abonnenten sie bekommen und warum.', 'Ändere einen Filter, zum Beispiel auf halle1/#, und sende noch einmal.', 'Schalte Retain an und sende vom Lager. Ändere dann den Filter von Alarm: Der neue Abonnent bekommt den letzten Wert sofort.', 'Gib ein eigenes Topic mit + ein: Der Broker lehnt es beim Senden ab.'], 'Was du tun kannst')}</div>`;
    updateMq();
  }
  function updateMq() {
    const m = S.mq, v = $('#mqView');
    setOn(v, 'data-mq', m.q); setOn(v, 'data-mr', m.r); $('#mqQ').textContent = QOSTXT[m.q];
    SUBN.forEach((n, i) => { const e = filterFehler(m.f[i]), el = $('[data-mfm="' + i + '"]', v); el.textContent = e ? '✗ ' + e : '✓ Filter gültig'; el.style.color = e ? 'var(--danger)' : 'var(--ok)'; });
    $('#mqHost').innerHTML = V.mqSvg({ pubs: DEV.map(d => ({ name: d.name, val: m.last && m.last.p === DEV.indexOf(d) ? m.last.pay : '' })).concat([{ name: 'Eigene', val: m.last && m.last.p === DEV.length ? m.last.pay : '' }]), subs: SUBN.map(n => ({ name: n })), last: m.last, retained: Object.keys(m.ret).length });
    $('#mqLog').innerHTML = m.log.length ? m.log.map(x => `<li>${esc(x)}</li>`).join('') : '<li>Noch keine Nachricht. Tippe bei einem Gerät auf „Senden“.</li>';
  }
  function mqSend(p, topic, pay) {
    const m = S.mq, e = topicFehler(topic); if (e) { toast(e); return; }
    const r = C.publish(m.ret, m.f.map(x => ({ f: x })), { topic, payload: pay, qos: m.q, retain: m.r === 1 });
    m.ret = r.retained; m.last = { p, to: r.to, pay: pay.slice(0, 10) };
    m.log.unshift('„' + topic + '“ = ' + (pay || '(leer)') + ' (QoS ' + m.q + (m.r ? ', Retain' : '') + ') geht an: ' + (r.to.length ? r.to.map(i => SUBN[i]).join(', ') : 'niemand') + (m.r && !pay ? '. Der gespeicherte Wert wird gelöscht.' : ''));
    m.log.length = Math.min(m.log.length, 6); updateMq();
  }
  const mv = $('#mqView');
  mv.addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.mf != null) { S.mq.f[+d.mf] = e.target.value.trim(); lsSet('mq', S.mq.f); updateMq(); }
    else if (d.mt === 'topic') S.mq.ptopic = e.target.value.trim(); else if (d.mt === 'pay') S.mq.ppay = e.target.value;
  });
  mv.addEventListener('change', e => {
    const i = e.target.dataset.mf; if (i == null) return; const m = S.mq, fl = m.f[+i];
    if (filterFehler(fl)) return;
    const got = C.retainedFor(m.ret, fl);
    m.log.unshift(SUBN[+i] + ' abonniert „' + fl + '“' + (got.length ? ' und bekommt sofort ' + got.length + ' zurückgehaltene Nachricht' + (got.length > 1 ? 'en' : '') + ': ' + got.map(g => g.topic + ' = ' + g.payload).join(', ') : ' (keine zurückgehaltene Nachricht dazu)'));
    m.log.length = Math.min(m.log.length, 6); updateMq();
  });
  mv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.mp != null) { const i = +d.mp; if (i < DEV.length) mqSend(i, DEV[i].topic, payOf(DEV[i].u)); else mqSend(i, S.mq.ptopic, S.mq.ppay); }
    else if (d.mq != null) { S.mq.q = +d.mq; updateMq(); } else if (d.mr != null) { S.mq.r = +d.mr; updateMq(); }
  });

  /* ============================================================ Zustand */
  function renderZu() {
    const z = S.zu, K = C.KINDS[z.kind];
    $('#zuView').innerHTML = `<div class="card pl"><h4>Zustand einer Maschine</h4>
      <div class="ctl">${lbl('Messgröße')}${seg('data-zk', [['temp', 'Lagertemperatur'], ['vib', 'Schwingung']], z.kind)}</div>
      <label class="f"><span>Grenzwert: <b data-zv="limit"></b></span><input type="range" data-zr="limit" min="${K.lmin}" max="${K.lmax}" step="${K.step}" value="${z.limit}" aria-label="Grenzwert"></label>
      <div class="ctl">${lbl('Meldung, wenn so viele Werte in Folge über der Grenze liegen')}${seg('data-zn', KS.map(x => [x, String(x)]), z.k)}</div>
      <label class="f"><span>Tag: <b data-zv="day"></b> von ${C.DAYS - 1}</span><input type="range" data-zr="day" min="${C.TREND_W - 1}" max="${C.DAYS - 1}" step="1" value="${z.day}" aria-label="Tag"></label>
      <div class="btns"><button class="btn" data-za="neu">🎲 Andere Maschine</button></div>
      <div class="vzbox" id="zuHost"></div><div id="zuOut"></div></div>
      <div class="card pl"><h4>Ausprobieren</h4>${stepsBox(['Schiebe den Tag nach rechts und sieh zu, wie die Kurve wächst und die Meldung kommt.', 'Senke die Grenze und stelle „1 Wert in Folge“ ein: Schon ein einzelner Ausreißer löst eine Meldung aus.', 'Stelle auf 3 Werte in Folge: Der Ausreißer ist kein Alarm mehr, ein echter Anstieg schon.', 'Schiebe den Tag vor die Meldung und lies die Restzeit aus dem Trend: So plant man die Wartung vorausschauend.'], 'Was du tun kannst')}</div>`;
    updateZu();
  }
  function updateZu() {
    const z = S.zu, K = C.KINDS[z.kind], vals = C.series(z.kind, z.seed), st = C.zustand(vals, z.day, z.limit, z.k), dec = K.dec, v = $('#zuView');
    $$('[data-zv]', v).forEach(s => { s.textContent = s.dataset.zv === 'limit' ? f(z.limit, dec) + ' ' + K.unit : String(z.day); });
    setOn(v, 'data-zk', z.kind); setOn(v, 'data-zn', z.k);
    $('#zuHost').innerHTML = V.zuSvg({ kind: z.kind, vals, day: z.day, limit: z.limit, k: z.k });
    $('#zuOut').innerHTML = box('Messwert an Tag ' + z.day, '', f(st.now, dec) + ' ' + K.unit)
      + (st.tr ? box('Trend der letzten ' + C.TREND_W + ' Tage', 'Ausgleichsgerade', (st.tr.slope >= 0 ? '+' : '−') + f(Math.abs(st.tr.slope), 2) + ' ' + K.unit + ' je Tag') : '')
      + (st.alarmDay >= 0 ? note('Wartungsmeldung seit Tag ' + st.alarmDay + ': ' + z.k + ' Wert' + (z.k > 1 ? 'e' : '') + ' in Folge lagen bei oder über ' + f(z.limit, dec) + ' ' + K.unit + '. Lager prüfen und einen Termin planen.', 'bad')
        : st.tr && Number.isFinite(st.tr.days) ? box('Grenze erreicht in etwa', 'Abstand zur Grenze / Anstieg je Tag. Grobe Schätzung: Steigt der Wert immer schneller, ist die Grenze früher erreicht.', f(st.tr.days, 0) + ' Tagen', 'warn')
          : note('Noch keine Meldung. Der Trend steigt nicht, es gibt keine Restzeit zu berechnen.', 'ok'))
      + (z.k === 1 && st.alarmDay >= 0 ? note('Mit 1 Wert in Folge kann schon ein einzelner Ausreißer die Meldung auslösen (Fehlalarm). Stelle auf 3 Werte in Folge und vergleiche.') : '');
  }
  const zv = $('#zuView');
  zv.addEventListener('input', e => { const k = e.target.dataset.zr; if (!k) return; S.zu[k] = +e.target.value; lsSet('zu', S.zu); updateZu(); });
  zv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset, z = S.zu;
    if (d.zk) { z.kind = d.zk; z.limit = C.KINDS[z.kind].limit; lsSet('zu', z); renderZu(); return; }
    if (d.zn) z.k = +d.zn; else if (d.za === 'neu') z.seed += 1; else return;
    lsSet('zu', z); updateZu();
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
  const eingabeHinweis = q => q.ask.type === 'num' ? `<p class="lr-hinweis hint2">Zahl in ${esc(q.ask.unit)}.${q.tol > 0.011 ? ' ±' + esc(f(q.tol, 2)) + ' ' + esc(q.ask.unit) + ' gelten als richtig (wegen Rundung).' : ''}</p>` : '';
  const stufeFuer = (ok, fehl, ex) => ok ? 'ok' : ex ? 'pruef' : fehl >= 2 ? 'loes' : 'tipp';
  const zeigFb = el => { try { const x = el && el.querySelector('.lr-fb'); if (x && root.LabRahmen) root.LabRahmen.zeig(x); } catch (e) {} };
  function qBody(q, a, r) {
    const lock = r && (r.ok || r.stufe === 'loes');
    if (q.ask.type === 'choice') return `<div class="opts">${q.ask.choices.map((c, i) => `<button data-tc="${i}" ${lock ? 'disabled' : ''} class="${lock && i === q.ask.correct ? 'ok' : a.c === i ? (r && !r.ok && r.given === c ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    return `<label class="f"><span>${esc(q.ask.label)} (${esc(q.ask.unit)})</span><div class="qin"><input data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${lock ? 'disabled' : ''}><span class="u">${esc(q.ask.unit)}</span></div>${eingabeHinweis(q)}</label>`;
  }
  const qHead = q => `<p style="margin:8px 0">${esc(q.text)}</p>${stepsBox(q.steps)}`;
  function evalQ(q, a) {
    if (q.ask.type === 'choice') { if (a.c == null) { toast('Wähle zuerst eine Antwort.'); return null; } return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    const v = P(a.v); if (!Number.isFinite(v)) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return null; }
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: f(v, 2) + ' ' + q.ask.unit };
  }
  function fbHTML(q, r) {
    if (r.stufe === 'ok') return `<div class="lr-fb ok fb"><p><strong>✓ Richtig:</strong> ${esc(r.given)}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    const ist = '<strong>Noch nicht:</strong> Deine Antwort „' + esc(r.given) + '“ stimmt nicht.';
    if (r.stufe === 'tipp') return `<div class="lr-fb tipp fb"><p>${ist}</p><p><strong>Tipp:</strong> ${esc(q.tips[0])} Du hast einen zweiten Versuch.</p></div>`;
    if (r.stufe === 'loes') return `<div class="lr-fb loes fb"><p>${ist}</p><p><strong>Lösung:</strong> ${esc(solText(q))}</p><p><strong>Lösungsweg:</strong> ${esc(q.expl)}</p></div>`;
    return `<div class="lr-fb tipp fb"><p>${ist}</p><p>🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp (kostet 25 %) oder versuche es noch einmal.</p></div>`;
  }
  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || {};
      h += `<div class="card pl" style="border-color:var(--accent)"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qHead(q)}${qBody(q, a, r)}`;
      if (r) h += fbHTML(q, r);
      h += `<div class="btns"><button class="btn pri" data-ta="chk"${r && (r.ok || r.stufe === 'loes') ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r && (r.ok || r.stufe === 'loes')) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`;
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h + ueb(); if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    const fehl = e.ok ? 0 : (S.tFehl[t.id] = (S.tFehl[t.id] || 0) + 1); S.tRes = { id: t.id, ok: e.ok, given: e.given, pct, stufe: stufeFuer(e.ok, fehl, exam()) };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast(S.tRes.stufe === 'loes' ? 'Lösung und Lösungsweg stehen unter der Aufgabe.' : 'Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false); zeigFb($('#taskView'));
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
    S.task = id; S.tq = D.makeTask(t); S.tAns = {}; S.tRes = null; S.tFehl[id] = 0;
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
  }
  const tv = $('#taskView');
  tv.addEventListener('input', e => { const t = curTask(); if (t && e.target.dataset.in) (S.tAns[t.id] = S.tAns[t.id] || {}).v = e.target.value; });
  tv.addEventListener('keydown', e => { const t = curTask(); if (t && e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); checkTask(t); } });
  tv.addEventListener('click', e => {
    const t = curTask(), tc = e.target.closest('[data-tc]'), ta = e.target.closest('[data-ta]'), row = e.target.closest('.row[data-t]');
    if (tc && t) { (S.tAns[t.id] = S.tAns[t.id] || {}).c = +tc.dataset.tc; renderTasks(false); return; }
    if (ta && t) { const a = ta.dataset.ta; if (a === 'chk') checkTask(t); else if (a === 'hint') hintFor(S.tq, t.id); else if (a === 'close') { S.task = null; S.tRes = null; renderTasks(); } else if (a === 'next') { const i = TASKS.findIndex(x => x.id === t.id), nx = TASKS.slice(i + 1).find(x => !done()[x.id]) || TASKS[(i + 1) % TASKS.length]; startTask(nx.id); } return; }
    if (row) startTask(row.dataset.t);
  });

  /* Zufalls-Trainer (Tipps kosten hier nie etwas) */
  function newTrainer() { const T = S.tr; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; T.fehl = 0; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl2" style="font-size:14px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qHead(q)}${qBody(q, T.ans, T.res)}${T.res ? fbHTML(q, T.res) : ''}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res && T.res.stufe !== 'tipp' ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res && T.res.stufe !== 'tipp' ? 'Nächste Frage' : 'Überspringen'}</button></div></div>`;
    if (T.res) zeigFb($('#rtView'));
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && (!T.res || T.res.stufe === 'tipp')) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if ((!T.res || T.res.stufe === 'tipp') && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr; if (T.res && T.res.stufe !== 'tipp') return; const e = evalQ(T.q, T.ans); if (!e) return;
    if (!e.ok && !T.fehl) { T.fehl = 1; T.res = { ok: false, given: e.given, stufe: 'tipp' }; sad(); renderTrainer(); return; }
    T.res = { ok: e.ok, given: e.given, stufe: e.ok ? 'ok' : 'loes' }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Hilfe */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      sec('Industrie 4.0: Begriffe', `<table><tr><th>Stufe</th><th>Kennzeichen</th></tr><tr><td>1. Mechanisierung</td><td>Wasser- und Dampfkraft treiben Maschinen an</td></tr><tr><td>2. Massenfertigung</td><td>Strom, Fließband, Arbeitsteilung</td></tr><tr><td>3. Automatisierung</td><td>Elektronik, SPS, Roboter</td></tr><tr><td>4. Vernetzung</td><td>Maschinen, Daten und Software sind verbunden</td></tr></table><ul><li><b>Cyber-physisches System:</b> Maschine (physisch) und Software (digital) tauschen über Sensoren, Aktoren und Netz laufend Daten aus.</li><li><b>Digitaler Zwilling:</b> Abbild einer Maschine in Software, das mit ihren echten Messdaten aktuell gehalten wird.</li><li><b>Edge:</b> Rechnen nah an der Maschine, schnell und ohne Netz. <b>Cloud:</b> zentrales Rechnen und Speichern, standortübergreifend.</li><li><b>Instandhaltung:</b> reaktiv (nach dem Ausfall), vorbeugend (nach Zeit), zustandsorientiert (bei Grenzwert), vorausschauend (aus Trend und Restlaufzeit, Predictive Maintenance).</li><li><b>Ziele:</b> Flexibilität, Transparenz, Effizienz, Rückverfolgbarkeit.</li></ul>`, true) +
      sec('Die Datenkette', `<div class="vzbox">${V.dkSvg({ t: 1, n: 100, b: 4, h: 20, av: 10 })}</div><p>Sensor, Mikrocontroller, Gateway (Edge), Netzwerk, Server (Cloud), Dashboard. Je früher man Daten verdichtet, desto weniger belasten sie Netz und Speicher.</p><span class="eq">4 bis 20 mA: Wert = Anfangswert + (I − 4 mA) / 16 mA · (Endwert − Anfangswert)</span><span class="eq">Wandler mit n Bit: 2^n Stufen, Stufe = Messbereich / 2^n</span>`) +
      sec('MQTT', `<div class="vzbox">${V.mqSvg({ pubs: DEV.map(d => ({ name: d.name, val: d.u === 't' ? '82 °C' : '' })), subs: SUBN.map(n => ({ name: n })), last: { p: 0, to: [0, 1] }, retained: 0 })}</div><ul><li><b>Broker</b> vermittelt. <b>Publisher</b> senden an ein Topic, <b>Subscriber</b> abonnieren Filter. Publisher und Subscriber kennen sich nicht.</li><li><b>Topic</b> mit Ebenen: halle1/linie2/temperatur.</li><li><b>+</b> ersetzt genau eine Ebene, <b>#</b> beliebig viele Ebenen und steht nur am Ende. Zum Senden gibt es keine Platzhalter.</li><li><b>QoS 0</b> höchstens einmal, <b>QoS 1</b> mindestens einmal (Duplikate möglich), <b>QoS 2</b> genau einmal.</li><li><b>Retain:</b> Der Broker behält die letzte Nachricht je Topic und gibt sie neuen Abonnenten sofort. Eine leere Nachricht mit Retain löscht sie.</li><li><b>Ports:</b> 1883 ohne Verschlüsselung, 8883 mit TLS.</li></ul>`) +
      sec('Maschinen anbinden: OPC UA und Modbus TCP', `<table><tr><th></th><th>OPC UA</th><th>Modbus TCP</th></tr><tr><td>Port</td><td>4840</td><td>502</td></tr><tr><td>Daten</td><td>Namen, Typen, Einheiten im Informationsmodell</td><td>nummerierte 16-Bit-Register, Bedeutung steht in der Gerätedokumentation</td></tr><tr><td>Ablauf</td><td>Client und Server, Durchsuchen (Browse), Abonnements</td><td>Client fragt, Server antwortet (Polling)</td></tr><tr><td>Sicherheit</td><td>Verschlüsselung und Zertifikate im Standard, müssen eingerichtet werden</td><td>keine Verschlüsselung und keine Anmeldung</td></tr></table><span class="eq">32-Bit-Wert = 2 Register zu 16 Bit</span><span class="eq">Lesebefehle = Register / 125, aufgerundet (höchstens 125 Register je Befehl)</span><p>Faustregel: Einfache Zahlen von einem Gerät, das Modbus spricht: Modbus TCP und im Gateway umrechnen. Herstellerübergreifend mit Namen und Einheiten: OPC UA. Viele Empfänger über das Internet: MQTT.</p>`) +
      sec('Datenmengen rechnen', `<span class="eq">Werte je Tag = Sensoren · 86.400 s / Intervall</span><span class="eq">Byte je Tag = Werte je Tag · Byte je Wert</span><span class="eq">Datenrate in bit/s = Sensoren · Byte je Wert · 8 / Intervall</span><span class="eq">Nutzdatenanteil = Nutzdaten / (Nutzdaten + Kopf)</span><span class="eq">Tage im Speicher = Speichergröße / Byte je Tag (abrunden)</span><span class="eq">Einsparung durch Mittelwert aus k Werten = (1 − 1 / k) · 100 %</span><p>Beispiel: 4 Byte alle 100 ms sind 40 Byte/s, am Tag 3.456.000 Byte, also etwa 3,46 MB. In diesem Lab gilt 1 kB = 1.000 Byte und 1 MB = 1.000.000 Byte.</p>`) +
      sec('IT-Sicherheit in vernetzten Anlagen', `<ul><li><b>Netze trennen:</b> Büro-IT und Maschinen-OT in getrennten Zonen, Übergänge nur über Firewall oder eine Pufferzone (DMZ). Nur nötige Ports öffnen.</li><li><b>Standardpasswörter</b> sofort ändern, je Gerät ein eigenes, langes Passwort.</li><li><b>Updates</b> prüfen, im Wartungsfenster einspielen, nur aus offizieller Quelle. Geräte ohne Updates abtrennen.</li><li><b>Verschlüsseln:</b> MQTT über TLS (8883). Modbus TCP ist nicht verschlüsselt, der Weg muss geschützt werden.</li><li><b>Fernwartung</b> nur über VPN mit persönlichem Konto, zeitlich begrenzt und protokolliert.</li><li><b>Fremde Geräte:</b> Schließe keine privaten Geräte oder Speichersticks an Maschinen und Anlagennetz an. Auffälliges meldest du sofort.</li><li><b>Datenschutz:</b> Maschinendaten mit Bedienerkennung sind personenbezogen. Nur erfassen, was nötig ist (Datenminimierung), und nur für den festgelegten Zweck.</li><li>Gesetze und Vorgaben zur Sicherheit vernetzter Produkte und Anlagen (zum Beispiel NIS2 und der Cyber Resilience Act) sollst du nur dem Namen nach kennen.</li></ul>`) + ueb();
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'dk'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    ({ dk: renderDk, mq: renderMq, zu: renderZu, tasks: renderTasks, rt: renderTrainer, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Industrie-4.0-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Industrie-4.0-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('dk');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['help', 'Hilfe und Formeln', 'Begriffe, Datenkette, MQTT, OPC UA, Modbus TCP, Datenmengen, IT-Sicherheit'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben, Tipps und die Trainer-Serie dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button class="btn" data-x="no">Abbrechen</button><button class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps', 'rt'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.rt = { n: 0, ok: 0, streak: 0, best: 0 }; S.task = null; S.tRes = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Schnittstelle für Karriere/Lernpfad */
  root.IOT_LAB = { id: 'iot', title: 'Industrie-4.0-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.IOT_TASKS };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'dk');
  /* Aufruf ?aufgabe=iot1 öffnet die Aufgabe */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try { const qa = new URLSearchParams(location.search).get('aufgabe'); if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
