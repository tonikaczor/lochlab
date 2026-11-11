'use strict';
/* Tonfunk Mechanik-Lab: Oberfläche (Lab-Kennung 'mch').
   ALLE Werkstoffkennwerte, Reibungszahlen, E-Module, Sicherheiten und Tabellenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Bauteile.
   Reiter: Kräfte (zerlegen, zusammensetzen), Hebel, Träger (Auflager), Reibung (schiefe Ebene), Spannung (Zug, Dehnung, Biegung, Sicherheit), Pressung und Abscheren, Schwerpunkt und Leistung, Aufgaben, Trainer, Beispiele, Hilfe.
   Module: mchcore.js (MCH_CORE), mchdata.js (MCH_DATA, MCH_TASKS), mchviz.js (MCH_VIZ: SVG-Zeichnungen und Zeigersteuerung).
   Speicher (Präfix lm4.mch.): tab, kr, he, tr, rb, sp, fp, wt, done ({id:true} nur gelöste), prog ({id:Prozent}), hints, ctipps (nur Prüfmodus), exam ('1'), rt (Trainer).
   Tipp-Abzug (25 % je Stufe, höchstens 2 Stufen) gibt es nur im Prüfmodus; beim normalen Üben kosten Tipps nichts.
   Stabile Kennungen für die zentrale Tour: Reiter #tab-<kürzel> (data-tab), Eingaben #in-<reiter>-<feld> (data-k), Zeichnung #vz-<reiter>, Ergebnis #out-<reiter>, Kopfzeile #bTasks #bExam #bHelp, Aufgabenliste #taskView.
   Aufruf: mchlab.html?aufgabe=mch1 öffnet die Aufgabe, mchlab.html?bsp öffnet die Beispiele (?bsp=kr1 springt zu einem Beispiel). */
(function (root) {
  const C = root.MCH_CORE, D = root.MCH_DATA, V = root.MCH_VIZ;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.mch.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true), P = s => C.parseDe(s);
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const fin = Number.isFinite;
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
    $('#mid').innerHTML = '<div class="wrap"><div class="card pl"><h4>Mechanik-Lab</h4><p class="big">Dateien fehlen</p><p class="hint2">mchcore.js, mchdata.js oder mchviz.js konnten nicht geladen werden. Bitte die Seite neu laden.</p></div></div>';
    return;
  }
  const TASKS = D.tasks;

  /* ============================================================ Zustand */
  const TABS = [['kr', '➚', 'Kräfte'], ['he', '⚖️', 'Hebel'], ['tr', '🌉', 'Träger'], ['rb', '📐', 'Reibung'], ['sp', '🔩', 'Spannung'], ['fp', '⚙️', 'Pressung & Scheren'], ['wt', '🎯', 'Schwerpunkt & Leistung'], ['tasks', '📝', 'Aufgaben'], ['rt', '🎲', 'Trainer'], ['bsp', '📖', 'Beispiele'], ['help', '📘', 'Hilfe']];
  const CALCS = ['kr', 'he', 'tr', 'rb', 'sp', 'fp', 'wt'];
  const DEF = {
    kr: { mode: 'comp', show: 'para', F1: '80', a1: '0', F2: '60', a2: '90', F: '100', a: '35' },
    he: { F1: '200', x1: '30', F2: '100', x2: '60' },
    tr: { L: '4', a: '0', b: '4', F1: '2000', x1: '1.5', F2: '0', x2: '3', q: '0', q1: '0', q2: '4' },
    rb: { mat: 'sh', m: '50', alpha: '20' },
    sp: { sub: 'zug', prof: 'kreis', d: '16', b: '20', h: '10', F: '30000', L: '1000', dr: 'zug', mat: 's235', lf: 'ruhig', bprof: 'rechteck', bb: '20', bh: '40', bd: '30', bD: '40', bdi: '30', bF: '3000', bL: '600' },
    fp: { sub: 'press', F: '10000', d: '12', t: '6', n: '1', Rm: '360', s: '3' },
    wt: { sub: 'sw', B: '80', t1: '12', t2: '12', H: '60', Pzu: '3', e1: '85', e2: '90', F: '500', s: '4', t: '8' }
  };
  const ENUM = { kr: { mode: ['comp', 'zerl'], show: ['para', 'eck'] }, rb: { mat: C.MU.map(m => m.id) }, sp: { sub: ['zug', 'bieg'], prof: ['kreis', 'rechteck'], dr: ['zug', 'druck'], mat: C.MAT.map(m => m.id), lf: Object.keys(C.S_REQ), bprof: ['rechteck', 'kreis', 'rohr'] }, fp: { sub: ['press', 'schub', 'loch'], n: ['1', '2'] }, wt: { sub: ['sw', 'ar'] } };
  function sane(tab, st) {
    const d = DEF[tab], o = Object.assign({}, d, st && typeof st === 'object' ? st : {});
    Object.keys(d).forEach(k => { if (typeof o[k] !== 'string') o[k] = d[k]; });
    Object.keys(ENUM[tab] || {}).forEach(k => { if (ENUM[tab][k].indexOf(o[k]) < 0) o[k] = d[k]; });
    return o;
  }
  const S = { tab: lsGet('tab', 'kr'), task: null, tq: null, tAns: {}, tRes: null, tr_: { q: null, ans: {}, res: null, level: 0 }, rt: Object.assign({ n: 0, ok: 0, streak: 0, best: 0 }, lsGet('rt', {})), prev: 0 };
  CALCS.forEach(t => { S[t] = sane(t, lsGet(t, {})); });
  const R0 = (() => { const m = /[?&]seed=([^&]+)/.exec(location.search); return C.rng(m ? decodeURIComponent(m[1]) : String(Math.random()) + Date.now()); })();

  /* ============================================================ Bausteine */
  const box = (t, fm, res, cls) => `<div class="rdout ${cls || ''}"><span class="st">${esc(t)}</span>${fm ? esc(fm) + (res !== '' ? ' = ' : '') : ''}<b>${esc(res)}</b></div>`;
  const note = (t, cls) => `<div class="rdout ${cls || 'warn'}">${esc(t)}</div>`;
  const inp = (tab, k, label, val, unit) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input id="in-${tab}-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
  const segB = (tab, k, opts, cur) => `<div class="seg" role="group">${opts.map(o => `<button id="seg-${tab}-${k}-${esc(o[0])}" data-seg="${k}" data-v="${esc(o[0])}" class="${String(cur) === String(o[0]) ? 'on' : ''}" aria-pressed="${String(cur) === String(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
  const sel = (tab, k, opts, cur) => `<select id="in-${tab}-${k}" data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const lbl = t => `<span class="lbl" style="font-size:12px;color:var(--mute)">${esc(t)}</span>`;
  const UEB = 'Alle Werkstoffkennwerte, Reibungszahlen, E-Module und Sicherheiten in diesem Lab sind Übungswerte für die Ausbildung, nicht für die Auslegung echter Bauteile. Maßgebend sind Tabellenbuch, Datenblatt, Normen und die Vorgaben deines Betriebs.';
  const ueb = () => `<div class="rdout warn">⚠ ${esc(UEB)}</div>`;
  const stripH = s => s.replace(/<g data-h="[^"]*" class="vz-hd">[\s\S]*?<\/g>/g, '');
  const matSel = (tab, cur) => sel(tab, 'mat', C.MAT.map(m => [m.id, m.n]), cur);
  const lfSel = (tab, cur) => sel(tab, 'lf', [['ruhig', 'ruhend (S = 1,5)'], ['wechselnd', 'wechselnd (S = 2)'], ['stoss', 'stoßartig (S = 3)']], cur);
  const num = (st, k) => P(st[k]);

  /* ============================================================ Rechner: Aufbau je Reiter (build liefert Zeichnung und Ergebnis) */
  const CALC = {
    kr: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Kräfte</h4><div class="fbar">${lbl('AUFGABE')}${segB('kr', 'mode', [['comp', 'Zusammensetzen'], ['zerl', 'Zerlegen']], st.mode)}</div>` + (st.mode === 'comp'
        ? `<div class="fbar">${lbl('DARSTELLUNG')}${segB('kr', 'show', [['para', 'Parallelogramm'], ['eck', 'Kräfteeck']], st.show)}</div><div class="dsrow">${inp('kr', 'F1', 'Kraft F1', st.F1, 'N')}${inp('kr', 'a1', 'Winkel von F1', st.a1, '°')}${inp('kr', 'F2', 'Kraft F2', st.F2, 'N')}${inp('kr', 'a2', 'Winkel von F2', st.a2, '°')}</div><p class="hint2">Winkel gegen die Waagerechte (nach rechts = 0°, nach oben = 90°). Du kannst auch die Pfeilspitzen in der Zeichnung ziehen.</p>`
        : `<div class="dsrow">${inp('kr', 'F', 'Kraft F', st.F, 'N')}${inp('kr', 'a', 'Winkel α gegen die Waagerechte', st.a, '°')}</div><p class="hint2">Ziehe die Pfeilspitze in der Zeichnung oder gib Zahlen ein.</p>`) + '</div>',
      build(st) {
        if (st.mode === 'zerl') {
          const F = num(st, 'F'), a = num(st, 'a');
          if (!(F >= 0) || !fin(a)) return { viz: V.zerlSvg({ F: 0, a: 0 }), out: note('Bitte Kraft und Winkel als Zahlen eingeben (Kraft nicht negativ).') };
          const c = C.comp(F, a);
          return { viz: V.zerlSvg({ F, a }), out: box('1. Waagerechter Anteil', 'Fx = F · cos α = ' + f(F, 1) + ' · cos ' + f(a, 0) + '°', f(c.x, 2) + ' N') + box('2. Senkrechter Anteil', 'Fy = F · sin α = ' + f(F, 1) + ' · sin ' + f(a, 0) + '°', f(c.y, 2) + ' N') + box('3. Probe', '√(Fx² + Fy²)', f(Math.hypot(c.x, c.y), 2) + ' N (gleich F)', 'ok') };
        }
        const F1 = num(st, 'F1'), a1 = num(st, 'a1'), F2 = num(st, 'F2'), a2 = num(st, 'a2');
        if (!(F1 >= 0) || !(F2 >= 0) || !fin(a1) || !fin(a2)) return { viz: V.forceSvg({ F1: 0, a1: 0, F2: 0, a2: 90, show: st.show }), out: note('Bitte beide Kräfte (nicht negativ) und Winkel als Zahlen eingeben.') };
        const u = C.comp(F1, a1), v = C.comp(F2, a2), r = C.resultant(F1, a1, F2, a2); let g = ((a2 - a1) % 360 + 360) % 360; if (g > 180) g = 360 - g;
        return { viz: V.forceSvg({ F1, a1, F2, a2, show: st.show }), out: box('1. Komponenten von F1', 'Fx = ' + f(u.x, 1) + ' N, Fy = ' + f(u.y, 1) + ' N', '') + box('2. Komponenten von F2', 'Fx = ' + f(v.x, 1) + ' N, Fy = ' + f(v.y, 1) + ' N', '') + box('3. Summe der Komponenten', 'ΣFx = ' + f(r.x, 1) + ' N, ΣFy = ' + f(r.y, 1) + ' N', '') + box('4. Resultierende', 'R = √(ΣFx² + ΣFy²)', f(r.R, 2) + ' N unter ' + f(r.ang, 1) + '°') + box('5. Kontrolle mit dem Kosinussatz (Winkel zwischen den Kräften ' + f(g, 0) + '°)', 'R = √(F1² + F2² + 2 · F1 · F2 · cos γ)', f(C.resMag(F1, F2, g), 2) + ' N', 'ok') };
      }
    },
    he: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Hebel mit zwei Lasten</h4><div class="dsrow">${inp('he', 'F1', 'Last links F1', st.F1, 'N')}${inp('he', 'x1', 'Abstand links l1', st.x1, 'cm, 0 bis 100')}${inp('he', 'F2', 'Last rechts F2', st.F2, 'N')}${inp('he', 'x2', 'Abstand rechts l2', st.x2, 'cm, 0 bis 100')}</div><p class="hint2">Verschiebe die Gewichte am Balken mit Finger oder Maus oder gib Zahlen ein. Der Balken ist gewichtslos angenommen.</p></div>`,
      build(st) {
        const F1 = num(st, 'F1'), x1 = num(st, 'x1'), F2 = num(st, 'F2'), x2 = num(st, 'x2');
        if (!(F1 >= 0) || !(F2 >= 0) || !(x1 >= 0) || !(x2 >= 0)) return { viz: V.leverSvg({ F1: 0, x1: 0, F2: 0, x2: 0 }), angle: 0, out: note('Bitte Kräfte und Abstände als Zahlen (nicht negativ) eingeben.') };
        const ls = V.leverState({ F1, x1, F2, x2 }), M1 = C.moment(F1, x1 / 100), M2 = C.moment(F2, x2 / 100); let out = box('1. Linksdrehendes Moment', 'M1 = F1 · l1 = ' + f(F1, 1) + ' N · ' + f(x1 / 100, 3) + ' m', f(M1, 2) + ' Nm') + box('2. Rechtsdrehendes Moment', 'M2 = F2 · l2 = ' + f(F2, 1) + ' N · ' + f(x2 / 100, 3) + ' m', f(M2, 2) + ' Nm');
        const eq = Math.abs(M1 - M2) <= Math.max(M1, M2, 1) * 0.005;
        out += `<div class="rdout ${eq ? 'ok' : 'warn'}"><span class="st">3. Momentengleichgewicht</span><b>${eq ? '✓ M1 = M2: Gleichgewicht' : 'Unterschied ' + esc(f(Math.abs(M1 - M2), 2)) + ' Nm: ' + (M2 > M1 ? 'rechts überwiegt' : 'links überwiegt')}</b></div>`;
        if (F2 > 0) out += box('4. Abstand rechts für Gleichgewicht', 'l2 = F1 · l1 / F2', f(C.leverL2(F1, x1, F2), 1) + ' cm' + (C.leverL2(F1, x1, F2) > 100 ? ' (länger als der Balken)' : ''));
        if (F2 > 0 || F1 > 0) out += box('5. Lagerkraft am Drehpunkt', 'F1 + F2', f(F1 + F2, 1) + ' N');
        return { viz: V.leverSvg({ F1, x1, F2, x2, prev: S.prev }), angle: ls.angle, out };
      }
    },
    tr: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Träger auf zwei Stützen</h4><div class="dsrow">${inp('tr', 'L', 'Trägerlänge', st.L, 'm')}${inp('tr', 'a', 'Lager A bei', st.a, 'm')}${inp('tr', 'b', 'Lager B bei', st.b, 'm')}</div><div class="dsrow">${inp('tr', 'F1', 'Einzellast 1', st.F1, 'N')}${inp('tr', 'x1', 'bei x', st.x1, 'm')}${inp('tr', 'F2', 'Einzellast 2 (0 = aus)', st.F2, 'N')}${inp('tr', 'x2', 'bei x', st.x2, 'm')}</div><div class="dsrow">${inp('tr', 'q', 'Streckenlast q (0 = aus)', st.q, 'N/m')}${inp('tr', 'q1', 'von', st.q1, 'm')}${inp('tr', 'q2', 'bis', st.q2, 'm')}</div><p class="hint2">Ziehe die Lasten (Pfeile, Griffe der Streckenlast) in der Zeichnung. Eigengewicht des Trägers bleibt unberücksichtigt, alle Lasten wirken senkrecht nach unten.</p></div>`,
      model(st) {
        const L = num(st, 'L'), a = num(st, 'a'), b = num(st, 'b'); if (!(L > 0) || !(a >= 0) || !(b > a) || a > L || b > L) return null;
        const loads = [], cx = v => Math.min(L, Math.max(0, v)); let F1 = num(st, 'F1'), F2 = num(st, 'F2'), q = num(st, 'q'), q1 = num(st, 'q1'), q2 = num(st, 'q2');
        if (F1 > 0 && fin(num(st, 'x1'))) loads.push({ t: 'F', F: F1, x: cx(num(st, 'x1')), id: 'F1' });
        if (F2 > 0 && fin(num(st, 'x2'))) loads.push({ t: 'F', F: F2, x: cx(num(st, 'x2')), id: 'F2' });
        if (q > 0 && fin(q1) && fin(q2)) { q1 = cx(q1); q2 = cx(q2); if (q2 < q1) { const t = q1; q1 = q2; q2 = t; } if (q2 - q1 > 1e-6) loads.push({ t: 'q', q, x1: q1, x2: q2, id: 'q' }); }
        return { L, a, b, loads };
      },
      build(st) {
        const bm = this.model(st); if (!bm) return { viz: V.beamSvg(null), out: note('Trägerlänge größer 0, Lager A links von Lager B und beide auf dem Träger (0 bis L). Bitte Zahlen prüfen.') };
        if (!bm.loads.length) return { viz: V.beamSvg(bm, { react: true, diag: true, handles: true }), out: note('Keine Last aktiv: Setze eine Last größer 0 ein.', 'ok') };
        const r = C.reactions(bm), mm = C.mmax(bm), span = bm.b - bm.a;
        let out = box('1. Gesamtlast', 'ΣF (Streckenlast als Einzelkraft q · Länge)', f(r.sum, 1) + ' N');
        out += box('2. Moment um Lager A', 'FB · ' + f(span, 2) + ' m = Σ Last · Abstand von A', f(r.FB * span, 1) + ' Nm');
        out += box('3. Auflagerkraft B', 'FB = Moment / Stützweite', f(r.FB, 2) + ' N') + box('4. Auflagerkraft A', 'FA = ΣF − FB', f(r.FA, 2) + ' N');
        out += `<div class="rdout ok"><span class="st">5. Probe</span>FA + FB = <b>${esc(f(r.FA + r.FB, 2))} N</b> (gleich der Gesamtlast)</div>` + box('6. Größtes Biegemoment', 'Mmax bei x = ' + f(mm.x, 2) + ' m', f(Math.abs(mm.M), 1) + ' Nm');
        if (r.FA < -1e-9 || r.FB < -1e-9) out += note('Eine Auflagerkraft ist negativ: Dieses Lager würde abheben (Zugkraft nötig). Lager oder Lasten verschieben.', 'bad');
        return { viz: V.beamSvg(bm, { react: true, diag: true, handles: true }), out };
      }
    },
    rb: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Schiefe Ebene und Reibung</h4><div class="dsrow"><label class="f"><span>Werkstoffpaar</span>${sel('rb', 'mat', C.MU.map(m => [m.id, m.n]), st.mat)}</label>${inp('rb', 'm', 'Masse', st.m, 'kg')}${inp('rb', 'alpha', 'Neigung α (0 bis 60)', st.alpha, '°')}</div><p class="hint2">Ziehe die obere Ecke der Ebene, um den Winkel zu ändern. Der blaue Kegel ist der Reibkegel: Liegt die Wirkungslinie von G darin, bleibt der Körper liegen.</p></div>`,
      build(st) {
        const mt = C.muOf(st.mat) || C.MU[0], m = num(st, 'm'), a = num(st, 'alpha');
        if (!(m >= 0) || !(a >= 0 && a <= 60)) return { viz: V.rampSvg({ alpha: 0, mu0: mt.mu0 }), out: note('Bitte Masse (nicht negativ) und einen Winkel zwischen 0° und 60° eingeben.') };
        const Gk = C.weight(m), FH = C.incFH(Gk, a), FN = C.incFN(Gk, a), FR0 = mt.mu0 * FN, hold = C.holds(a, mt.mu0), rho = C.critAngle(mt.mu0);
        let out = box('1. Gewichtskraft', 'G = m · g = ' + f(m, 1) + ' kg · 9,81 m/s²', f(Gk, 1) + ' N') + box('2. Hangabtrieb (entlang der Ebene)', 'FH = G · sin α', f(FH, 1) + ' N') + box('3. Normalkraft (senkrecht zur Ebene)', 'FN = G · cos α', f(FN, 1) + ' N') + box('4. Größte Haftreibung', 'FR0 = μ0 · FN = ' + f(mt.mu0, 2) + ' · ' + f(FN, 1), f(FR0, 1) + ' N');
        out += `<div class="rdout ${hold ? 'ok' : 'bad'}"><span class="st">5. Ergebnis</span><b>${hold ? '✓ Bleibt liegen (FH ≤ FR0, tan α ≤ μ0)' : '✗ Rutscht (FH größer als FR0, tan α > μ0)'}</b></div>` + box('6. Grenzwinkel (Reibwinkel)', 'ρ0 = arctan μ0 = arctan ' + f(mt.mu0, 2), f(rho, 1) + '°');
        out += box('7. Haltekraft parallel zur Ebene (damit nichts rutscht)', 'FH − FR0', f(C.rampHold(Gk, a, mt.mu0), 1) + ' N') + box('8. Zugkraft hinauf bei gleichbleibender Geschwindigkeit (Gleitreibung μ = ' + f(mt.mu, 2) + ')', 'G · (sin α + μ · cos α)', f(C.rampUp(Gk, a, mt.mu), 1) + ' N');
        return { viz: V.rampSvg({ alpha: a, mu0: mt.mu0 }), out };
      }
    },
    sp: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Spannung, Dehnung und Sicherheit</h4><div class="fbar">${lbl('BELASTUNG')}${segB('sp', 'sub', [['zug', 'Zug und Druck'], ['bieg', 'Biegung']], st.sub)}</div>` + (st.sub === 'zug'
        ? `<div class="fbar">${lbl('QUERSCHNITT')}${segB('sp', 'prof', [['kreis', 'Rundstab'], ['rechteck', 'Flachstab']], st.prof)}${segB('sp', 'dr', [['zug', 'Zug'], ['druck', 'Druck']], st.dr)}</div><div class="dsrow">${st.prof === 'kreis' ? inp('sp', 'd', 'Durchmesser d', st.d, 'mm') : inp('sp', 'b', 'Breite b', st.b, 'mm') + inp('sp', 'h', 'Dicke h', st.h, 'mm')}${inp('sp', 'F', 'Kraft F', st.F, 'N')}${inp('sp', 'L', 'Länge L', st.L, 'mm')}</div>`
        : `<div class="fbar">${lbl('QUERSCHNITT')}${segB('sp', 'bprof', [['rechteck', 'Rechteck'], ['kreis', 'Vollkreis'], ['rohr', 'Rohr']], st.bprof)}</div><div class="dsrow">${st.bprof === 'rechteck' ? inp('sp', 'bb', 'Breite b', st.bb, 'mm') + inp('sp', 'bh', 'Höhe h (in Lastrichtung)', st.bh, 'mm') : st.bprof === 'kreis' ? inp('sp', 'bd', 'Durchmesser d', st.bd, 'mm') : inp('sp', 'bD', 'Außendurchmesser D', st.bD, 'mm') + inp('sp', 'bdi', 'Innendurchmesser d', st.bdi, 'mm')}${inp('sp', 'bF', 'Last in der Mitte F', st.bF, 'N')}${inp('sp', 'bL', 'Stützweite L', st.bL, 'mm')}</div>`)
        + `<div class="dsrow"><label class="f"><span>Werkstoff</span>${matSel('sp', st.mat)}</label><label class="f"><span>Lastfall (geforderte Sicherheit)</span>${lfSel('sp', st.lf)}</label></div></div>`,
      build(st) {
        const mt = C.matOf(st.mat) || C.MAT[0], lim = C.limOf(mt), Sreq = C.S_REQ[st.lf] || 1.5;
        const verdict = (S, sg) => `<div class="rdout ${S >= Sreq ? 'ok' : 'bad'}"><span class="st">Beurteilung (geforderte Sicherheit ${esc(f(Sreq, 1))})</span><b>${S >= Sreq ? '✓ ausreichend' : '✗ nicht ausreichend'}</b></div>`;
        if (st.sub === 'bieg') {
          const F = num(st, 'bF'), L = num(st, 'bL'); let W = NaN, name = '', sv = { prof: st.bprof };
          if (st.bprof === 'rechteck') { const b = num(st, 'bb'), h = num(st, 'bh'); W = C.Wrect(b, h); name = 'W = b · h² / 6 = ' + f(b, 1) + ' · ' + f(h, 1) + '² / 6'; sv.b = b; sv.h = h; }
          else if (st.bprof === 'kreis') { const d = num(st, 'bd'); W = C.Wcirc(d); name = 'W = π · d³ / 32 = π · ' + f(d, 1) + '³ / 32'; sv.d = d; }
          else { const D2 = num(st, 'bD'), di = num(st, 'bdi'); W = C.Wring(D2, di); name = 'W = π · (D⁴ − d⁴) / (32 · D)'; sv.D = D2; sv.di = di; }
          if (!(F >= 0) || !(L > 0) || !(W > 0)) return { viz: V.bendSvg({ prof: 'rechteck', b: 20, h: 40 }), out: note('Bitte Last, Stützweite und Maße als Zahlen eingeben (Maße größer 0, beim Rohr d kleiner als D).') };
          const Mb = F * L / 4, sg = C.sigmaB(Mb, W), S = C.safety(lim, sg); sv.sigma = sg;
          return { viz: V.bendSvg(sv), out: box('1. Größtes Biegemoment (Einzellast in der Mitte)', 'Mb = F · L / 4 = ' + f(F, 0) + ' · ' + f(L, 0) + ' / 4', f(Mb, 0) + ' Nmm (' + f(Mb / 1000, 1) + ' Nm)') + box('2. Widerstandsmoment', name, f(W, 0) + ' mm³') + box('3. Biegespannung', 'σb = Mb / W', f(sg, 1) + ' N/mm²') + box('4. Sicherheit (' + (mt.zaeh ? 'Re ' : 'Rm ') + f(lim, 0) + ' N/mm²)', 'S = ' + (mt.zaeh ? 'Re' : 'Rm') + ' / σb', f(S, 2)) + verdict(S, sg) + box('5. Zulässige Last in der Mitte', 'Fzul = (' + f(lim, 0) + ' / ' + f(Sreq, 1) + ') · W · 4 / L', f(lim / Sreq * W * 4 / L, 0) + ' N') };
        }
        const dr = st.dr === 'druck', F = num(st, 'F'), L = num(st, 'L'), A = st.prof === 'kreis' ? C.areaCirc(num(st, 'd')) : C.areaRect(num(st, 'b'), num(st, 'h'));
        if (!(F >= 0) || !(L > 0) || !(A > 0)) return { viz: V.rodSvg({ F: 0, L: 0, dL: 0, eps: 0 }), hk: V.hookeSvg({ sigma: 0, lim }), out: note('Bitte Kraft, Länge und Maße als Zahlen eingeben (Länge und Maße größer 0).') };
        const sg = F / A, eps = sg / mt.E, S = C.safety(lim, sg), over = sg > lim + 1e-9, dL = eps * L;
        let out = box('1. Querschnittsfläche', st.prof === 'kreis' ? 'A = π · d² / 4' : 'A = b · h', f(A, 1) + ' mm²') + box('2. ' + (dr ? 'Druckspannung' : 'Zugspannung'), 'σ = F / A = ' + f(F, 0) + ' / ' + f(A, 1), f(sg, 1) + ' N/mm²');
        out += box('3. Dehnung nach Hooke (E = ' + f(mt.E, 0) + ' N/mm²)', 'ε = σ / E', f(eps * 100, 4) + ' %') + box('4. ' + (dr ? 'Verkürzung' : 'Verlängerung'), 'ΔL = ε · L', f(dL, 3) + ' mm');
        if (over) out += note('Die Spannung liegt über der Grenzspannung: Hooke gilt nicht mehr, das Bauteil verformt sich bleibend oder bricht. ΔL und ε sind dann nicht mehr zutreffend.', 'bad');
        out += box('5. Sicherheit (' + (mt.zaeh ? 'Re ' : 'Rm ') + f(lim, 0) + ' N/mm²)', 'S = ' + (mt.zaeh ? 'Re' : 'Rm') + ' / σ', f(S, 2)) + verdict(S, sg) + box('6. Zulässige Kraft bei geforderter Sicherheit', 'Fzul = (' + f(lim, 0) + ' / ' + f(Sreq, 1) + ') · A', f(lim / Sreq * A, 0) + ' N');
        if (dr) out += note('Hinweis: Lange, schlanke Druckstäbe knicken schon bei kleinerer Last (Knicken wird in diesem Lab nicht berechnet).', 'warn');
        return { viz: V.rodSvg({ F, L, dL, eps, druck: dr }), hk: V.hookeSvg({ sigma: sg, lim, zaeh: mt.zaeh }), out };
      }
    },
    fp: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Flächenpressung und Abscheren</h4><div class="fbar">${lbl('BELASTUNG')}${segB('fp', 'sub', [['press', 'Flächenpressung'], ['schub', 'Abscheren'], ['loch', 'Lochen']], st.sub)}</div><div class="dsrow">` + (st.sub === 'press'
        ? inp('fp', 'F', 'Kraft F', st.F, 'N') + inp('fp', 'd', 'Bolzendurchmesser d', st.d, 'mm') + inp('fp', 't', 'Blechdicke t', st.t, 'mm')
        : st.sub === 'schub' ? inp('fp', 'F', 'Kraft F', st.F, 'N') + inp('fp', 'd', 'Bolzendurchmesser d', st.d, 'mm') + `<label class="f"><span>Scherflächen</span>${sel('fp', 'n', [['1', 'einschnittig (1)'], ['2', 'zweischnittig (2)']], st.n)}</label>` + inp('fp', 'Rm', 'Zugfestigkeit Rm', st.Rm, 'N/mm²')
          : inp('fp', 'd', 'Lochdurchmesser d', st.d, 'mm') + inp('fp', 's', 'Blechdicke s', st.s, 'mm') + inp('fp', 'Rm', 'Zugfestigkeit Rm', st.Rm, 'N/mm²')) + '</div></div>',
      build(st) {
        const F = num(st, 'F'), d = num(st, 'd'), t = num(st, 't'), nn = +st.n === 2 ? 2 : 1, Rm = num(st, 'Rm'), s = num(st, 's'), bad = what => ({ viz: V.pressSvg({ sub: st.sub, d: 10, t: 5, n: nn, s: 3 }), out: note('Bitte ' + what + ' als Zahlen größer 0 eingeben.') });
        if (st.sub === 'press') {
          if (!(F >= 0) || !(d > 0) || !(t > 0)) return bad('Kraft, Durchmesser und Blechdicke');
          const p = C.pressure(F, d, t); return { viz: V.pressSvg({ sub: 'press', d, t }), out: box('1. Projizierte Fläche', 'A = d · t = ' + f(d, 1) + ' · ' + f(t, 1), f(d * t, 1) + ' mm²') + box('2. Flächenpressung', 'p = F / (d · t) = ' + f(F, 0) + ' / ' + f(d * t, 1), f(p, 1) + ' N/mm²') + note('Ob die Pressung zulässig ist, entscheidet der schwächere Werkstoff von Bolzen und Blech (Tabellenbuch, Betriebsvorgabe).', 'warn') };
        }
        if (st.sub === 'schub') {
          if (!(F >= 0) || !(d > 0) || !(Rm > 0)) return bad('Kraft, Durchmesser und Zugfestigkeit');
          const A = C.areaCirc(d), tau = C.shearTau(F, d, nn), tb = C.tauAB(Rm);
          return { viz: V.pressSvg({ sub: 'schub', d, n: nn, t: 5 }), out: box('1. Bolzenquerschnitt', 'A = π · d² / 4', f(A, 1) + ' mm²') + box('2. Scherspannung', 'τ = F / (n · A) = ' + f(F, 0) + ' / (' + nn + ' · ' + f(A, 1) + ')', f(tau, 1) + ' N/mm²') + box('3. Abscherfestigkeit', 'τaB = 0,8 · Rm', f(tb, 0) + ' N/mm²') + box('4. Sicherheit gegen Abscheren', 'S = τaB / τ', f(tb / tau, 2)) + `<div class="rdout ${tb / tau >= 1.5 ? 'ok' : 'bad'}"><span class="st">Beurteilung (Übungswert: S ≥ 1,5)</span><b>${tb / tau >= 1.5 ? '✓ ausreichend' : '✗ nicht ausreichend'}</b></div>` };
        }
        if (!(d > 0) || !(s > 0) || !(Rm > 0)) return bad('Durchmesser, Blechdicke und Zugfestigkeit');
        const tb = C.tauAB(Rm), Fk = C.punchF(tb, d, s);
        return { viz: V.pressSvg({ sub: 'loch', d, s, t: s }), out: box('1. Abscherfestigkeit', 'τaB = 0,8 · Rm', f(tb, 0) + ' N/mm²') + box('2. Scherfläche (Zylindermantel)', 'A = π · d · s = π · ' + f(d, 1) + ' · ' + f(s, 1), f(Math.PI * d * s, 1) + ' mm²') + box('3. Stempelkraft', 'F = τaB · A', f(Fk / 1000, 2) + ' kN (' + f(Fk, 0) + ' N)') };
      }
    },
    wt: {
      form: st => `<div class="card pl" data-tour="calc"><h4>Schwerpunkt, Arbeit und Leistung</h4><div class="fbar">${lbl('THEMA')}${segB('wt', 'sub', [['sw', 'Schwerpunkt'], ['ar', 'Arbeit, Leistung, Wirkungsgrad']], st.sub)}</div><div class="dsrow">` + (st.sub === 'sw'
        ? inp('wt', 'B', 'Grundplatte Breite', st.B, 'mm') + inp('wt', 't1', 'Grundplatte Höhe', st.t1, 'mm') + inp('wt', 't2', 'Steg Breite', st.t2, 'mm') + inp('wt', 'H', 'Steg Höhe', st.H, 'mm')
        : inp('wt', 'F', 'Kraft in Bewegungsrichtung', st.F, 'N') + inp('wt', 's', 'Weg', st.s, 'm') + inp('wt', 't', 'Zeit', st.t, 's') + inp('wt', 'Pzu', 'Zugeführte Leistung', st.Pzu, 'kW') + inp('wt', 'e1', 'Wirkungsgrad Stufe 1', st.e1, '%') + inp('wt', 'e2', 'Wirkungsgrad Stufe 2', st.e2, '%')) + '</div></div>',
      build(st) {
        if (st.sub === 'sw') {
          const B = num(st, 'B'), t1 = num(st, 't1'), t2 = num(st, 't2'), H = num(st, 'H');
          if (!(B > 0) || !(t1 > 0) || !(t2 > 0) || !(H > 0)) return { viz: V.centroidSvg({ B: 80, t1: 12, t2: 12, H: 60 }), out: note('Bitte alle Maße als Zahlen größer 0 eingeben.') };
          const p1 = C.rectPart(B, t1, 0, 0), p2 = C.rectPart(t2, H, 0, t1), g = C.centroid([p1, p2]);
          return { viz: V.centroidSvg({ B, t1, t2, H }), out: box('1. Teilfläche 1 (Grundplatte)', 'A1 = ' + f(B, 1) + ' · ' + f(t1, 1) + ', y1 = ' + f(p1.y, 1) + ' mm', f(p1.A, 1) + ' mm²') + box('2. Teilfläche 2 (Steg)', 'A2 = ' + f(t2, 1) + ' · ' + f(H, 1) + ', y2 = ' + f(p2.y, 1) + ' mm', f(p2.A, 1) + ' mm²') + box('3. Schwerpunkt über der Unterkante', 'ys = (A1 · y1 + A2 · y2) / (A1 + A2)', f(g.y, 2) + ' mm') + box('4. Schwerpunkt von der linken Kante', 'xs = (A1 · x1 + A2 · x2) / (A1 + A2)', f(g.x, 2) + ' mm') };
        }
        const F = num(st, 'F'), s = num(st, 's'), t = num(st, 't'), Pz = num(st, 'Pzu'), e1 = num(st, 'e1') / 100, e2 = num(st, 'e2') / 100;
        if (!(F >= 0) || !(s >= 0) || !(t > 0) || !(Pz > 0) || !(e1 > 0 && e1 <= 1) || !(e2 > 0 && e2 <= 1)) return { viz: V.effSvg({ Pzu: 3, e1: 0.85, e2: 0.9 }), out: note('Bitte Zahlen eingeben: Zeit und Leistung größer 0, Wirkungsgrade zwischen 0 und 100 %.') };
        const W = C.work(F, s), P = C.powerW(W, t), eg = e1 * e2;
        return { viz: V.effSvg({ Pzu: Pz, e1, e2 }), out: box('1. Arbeit', 'W = F · s = ' + f(F, 0) + ' N · ' + f(s, 2) + ' m', f(W, 1) + ' J') + box('2. Leistung', 'P = W / t = ' + f(W, 1) + ' J / ' + f(t, 1) + ' s', f(P, 1) + ' W (' + f(P / 1000, 3) + ' kW)') + box('3. Gesamtwirkungsgrad', 'ηges = η1 · η2 = ' + f(e1, 2) + ' · ' + f(e2, 2), f(eg * 100, 1) + ' %') + box('4. Abgegebene Leistung', 'P_ab = P_zu · ηges', f(Pz * eg, 2) + ' kW') + box('5. Verlustleistung', 'P_V = P_zu − P_ab', f(Pz - Pz * eg, 2) + ' kW') };
      }
    }
  };
  /* Beschreibung der Reiter-Seite (Formular, Zeichnung, Ergebnis) */
  function calcPage(tab, st) {
    const b = CALC[tab].build(st), extra = tab === 'sp' && b.hk ? `<div class="inst">${b.hk}</div>` : '';
    return { b, html: ueb() + CALC[tab].form(st) + `<div class="inst" id="vz-${tab}" data-tour="viz">${b.viz}</div><div id="hk-${tab}">${extra}</div><div id="out-${tab}">${b.out}</div>` };
  }
  function renderCalc(tab) { const p = calcPage(tab, S[tab]); $('#' + tab + 'View').innerHTML = p.html; tilt(tab, p.b); }
  function tilt(tab, b) { if (tab === 'he' && b && fin(b.angle)) { const a = b.angle; requestAnimationFrame(() => { const el = $('#lvTilt'); if (el && el.style) el.style.transform = 'rotate(' + a + 'deg)'; S.prev = a; }); } }
  function updateCalc(tab) {
    const b = CALC[tab].build(S[tab]), vz = $('#vz-' + tab), out = $('#out-' + tab); if (!vz || !out) return;
    vz.innerHTML = b.viz; out.innerHTML = b.out; if (tab === 'sp') { const hk = $('#hk-sp'); if (hk) hk.innerHTML = b.hk ? `<div class="inst">${b.hk}</div>` : ''; } tilt(tab, b);
  }
  function syncIn(tab) { const st = S[tab]; $$('#' + tab + 'View [data-k]').forEach(el => { const k = el.dataset.k; if (el !== document.activeElement && st[k] != null) el.value = st[k]; }); }
  CALCS.forEach(tab => {
    const el = $('#' + tab + 'View');
    const upd = e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; S[tab][k] = e.target.value; lsSet(tab, S[tab]); updateCalc(tab); };
    el.addEventListener('input', upd); el.addEventListener('change', e => { upd(e); const k = e.target.dataset && e.target.dataset.k; if (k && e.target.tagName === 'SELECT' && ((tab === 'fp' && k === 'n') || (tab === 'sp' && k === 'mat'))) { /* Zeichnung bleibt aktuell */ } });
    el.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('[data-seg]') : null; if (!b) return; S[tab][b.dataset.seg] = b.dataset.v; S[tab] = sane(tab, S[tab]); lsSet(tab, S[tab]); renderCalc(tab); });
  });

  /* ============================================================ Ziehen in den Zeichnungen */
  const rnd = v => String(Math.round(v)), clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  function setPolar(st, kF, kA, dx, dy, max) { const r = Math.hypot(dx, dy) / V.KSC; st[kF] = rnd(clampN(r, 0, max)); if (r > 1) st[kA] = rnd(Math.atan2(dy, dx) / C.RAD); }
  function dragKr(id, p) {
    const st = S.kr;
    if (id === 'F') setPolar(st, 'F', 'a', p.x - V.KO.x, V.KO.y - p.y, V.ZMAX);
    else if (id === 'F1') setPolar(st, 'F1', 'a1', p.x - V.KO.x, V.KO.y - p.y, V.KMAX);
    else if (id === 'F2') { let ox = V.KO.x, oy = V.KO.y; if (st.show === 'eck') { const F1 = clampN(P(st.F1) || 0, 0, V.KMAX), a1 = P(st.a1) || 0; ox += F1 * V.KSC * Math.cos(a1 * C.RAD); oy -= F1 * V.KSC * Math.sin(a1 * C.RAD); } setPolar(st, 'F2', 'a2', p.x - ox, oy - p.y, V.KMAX); }
    else return false; return true;
  }
  function dragHe(id, p) {
    const st = S.he, th = (S.prev || 0) * C.RAD, s = (p.x - V.LPV.x) * Math.cos(th) + (p.y - V.LPV.y) * Math.sin(th), cm = clampN(Math.round(Math.abs(s) / V.LSC), 0, 100);
    if (id === 'x1') st.x1 = rnd(s < 0 ? cm : 0); else if (id === 'x2') st.x2 = rnd(s > 0 ? cm : 0); else return false; return true;
  }
  function dragTr(id, p) {
    const st = S.tr, L = P(st.L); if (!(L > 0)) return false; const x = Math.round(clampN((p.x - 56) / (528 / L), 0, L) * 10) / 10, s = v => String(v).replace('.', ',');
    if (id === 'F1') st.x1 = s(x); else if (id === 'F2') st.x2 = s(x); else if (id === 'q1') { const q2 = P(st.q2); st.q1 = s(Math.min(x, (fin(q2) ? q2 : L) - 0.2 < 0 ? 0 : (fin(q2) ? q2 : L) - 0.2)); } else if (id === 'q2') { const q1 = P(st.q1); st.q2 = s(Math.max(x, (fin(q1) ? q1 : 0) + 0.2)); } else return false; return true;
  }
  function dragRb(id, p) { if (id !== 'alpha') return false; S.rb.alpha = rnd(clampN(Math.atan2(V.RP0.y - p.y, p.x - V.RP0.x) / C.RAD, 0, 60)); return true; }
  const DRAG = { kr: dragKr, he: dragHe, tr: dragTr, rb: dragRb };
  Object.keys(DRAG).forEach(tab => { V.attach($('#' + tab + 'View'), (id, p, ph) => { if (DRAG[tab](id, p)) { if (ph === 'end') lsSet(tab, S[tab]); updateCalc(tab); syncIn(tab); } }); });

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
  const qText = t => `<p style="margin:8px 0;white-space:pre-line">${esc(t)}</p>`;
  function qBody(q, a, r, pre) {
    const dn = r && (r.ok || pre === 'rt'), as = q.ask; let h = '';
    if (q.fig) h += `<div class="inst" data-tour="fig">${V.taskFig(q.fig)}</div><p class="hint2" style="margin:0 0 6px">Skizze mit den gegebenen Größen. Gesuchte Größen sind nicht eingezeichnet.</p>`;
    if (as.type === 'choice') h += `<div class="opts">${as.choices.map((c, i) => `<button data-tc="${i}" ${dn ? 'disabled' : ''} class="${r && i === as.correct && dn ? 'ok' : a.c === i ? (r && !r.ok ? 'bad' : 'on') : ''}">${esc(c)}</button>`).join('')}</div>`;
    else h += `<label class="f"><span>${esc(as.label)}${as.unit ? ' (' + esc(as.unit) + ')' : ''}</span><div class="qin"><input id="in-task-${pre}" data-in="1" inputmode="decimal" autocomplete="off" value="${esc(a.v || '')}" ${dn ? 'disabled' : ''}><span class="u">${esc(as.unit)}</span></div></label>`;
    return h;
  }
  function evalQ(q, a) { const e = D.evaluate(q, a); if (e.err) { toast(e.err); return null; } return e; }
  const resBlock = (q, r, showExpl) => `<ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Richtig: ' + esc(r.given) : '✗ Deine Antwort „' + esc(r.given) + '“ stimmt nicht.'}</li>${q.ask.type === 'num' && q.tol > 0.011 ? `<li>ℹ Erlaubte Abweichung: ±${esc(f(q.tol, 2))} ${esc(q.ask.unit)} (wegen Rundung).</li>` : ''}</ul>` +
    (showExpl ? `<div class="rdout ${r.ok ? 'ok' : 'bad'}"><b>Lösung:</b> ${esc(D.solText(q))}<br><br><b>Lösungsweg:</b> ${esc(q.expl)}</div>` : '<div class="rdout bad">🎓 Prüfmodus: Den Lösungsweg gibt es erst, wenn die Aufgabe richtig gelöst ist. Nutze einen Tipp oder versuche es noch einmal.</div>');

  function renderTasks(top) {
    const Vw = $('#taskView'), d = done(), prog = lsGet('prog', {}), t = curTask(), n100 = TASKS.filter(x => d[x.id]).length; let h = '';
    if (t) {
      const q = S.tq, r = S.tRes && S.tRes.id === t.id ? S.tRes : null, a = S.tAns[t.id] || (S.tAns[t.id] = {});
      h += `<div class="card pl" style="border-color:var(--accent)" id="taskCard"><h4>Aufgabe · ${esc(t.cat)}</h4><div class="big">${esc(t.title)}</div><div class="lv">${dots(t.level)}</div>${qText(q.text)}${qBody(q, a, r, 'tk')}`;
      h += `<div class="btns"><button class="btn pri" id="task-check" data-ta="chk"${r && r.ok ? ' disabled' : ''}>✓ Prüfen</button><button class="btn" id="task-hint" data-ta="hint">💡 Tipp</button><button class="btn" data-ta="close">Schließen</button></div>`;
      if (exam()) h += '<p class="hint2" style="color:var(--warn)">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      if (r) { h += resBlock(q, r, r.ok || !exam()); if (r.ok) h += `<div class="btns"><button class="btn pri" data-ta="next">Nächste Aufgabe</button></div>`; }
      h += '</div>';
    }
    h += `<p class="hint2" style="margin:4px 0 0">${n100} von ${TASKS.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Tipp: Im Prüfmodus (🎓 oben) zählen Tipps als Abzug.'}</p><p class="hint2" style="margin:4px 0 0">⚠ ${esc(UEB)}</p>`;
    let last = '';
    TASKS.forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button class="row" id="task-${esc(x.id)}" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : ''}">${d[x.id] ? '✓' : ''}</span><div class="grow"><b>${esc(x.title)}</b><small><span class="lv">${dots(x.level)}</span>${p != null && p < 100 ? ' · bisher ' + p + ' %' : ''}</small></div></button>`; });
    Vw.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0;
  }
  function checkTask(t) {
    const a = S.tAns[t.id] || {}, e = evalQ(S.tq, a); if (!e) return; const pct = e.ok ? pctFor(t.id) : 0;
    S.tRes = { id: t.id, ok: e.ok, given: e.given, pct };
    if (e.ok) { markSolved(t.id, pct); const F = fx(); if (F && F.pass) try { F.pass(pct); } catch (er) {} else ding(); toast(exam() && pct < 100 ? pct + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); } else { sad(); toast('Noch nicht richtig. Lies die Hinweise und versuche es noch einmal.'); }
    renderTasks(false);
  }
  function hintFor(q, id) {
    const h = lsGet('hints', {}), n = Math.min(2, (h[id] || 0) + 1), ex = exam(); h[id] = Math.max(h[id] || 0, n); lsSet('hints', h);
    if (ex && id !== 'rt') { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 2', b => {
      let x = `<p style="margin-top:0"><b>Stufe 1:</b> ${esc(q.tips[0])}</p>`; if (n >= 2) x += `<p><b>Stufe 2:</b> ${esc(q.tips[1])}</p>`;
      x += n >= 2 ? '<p class="hint2">Mehr Tipps gibt es nicht. Den Lösungsweg siehst du nach dem Prüfen.</p>' : '<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“.</p>';
      x += ex && id !== 'rt' ? '<p class="hint2" style="color:var(--warn)">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
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
  function newTrainer() { const T = S.tr_; T.q = D.randomQ(R0, T.level); T.ans = {}; T.res = null; renderTrainer(); }
  function renderTrainer() {
    const T = S.tr_; if (!T.q) { newTrainer(); return; }
    const q = T.q;
    $('#rtView').innerHTML = `<div class="stats"><div class="bx"><b>${S.rt.n}</b>Fragen</div><div class="bx"><b>${S.rt.ok}</b>richtig</div><div class="bx"><b>${S.rt.streak}</b>Serie</div><div class="bx"><b>${S.rt.best}</b>Beste Serie</div></div>
      <div class="fbar"><span class="lbl" style="font-size:12px;color:var(--mute)">STUFE</span><div class="seg">${[[0, 'Alle'], [1, '1'], [2, '2'], [3, '3']].map(l => `<button data-lv="${l[0]}" class="${T.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
      <div class="card pl"><h4>${esc(q.cat)} · <span class="lv">${dots(q.level)}</span></h4><div class="big">${esc(q.title)}</div>${qText(q.text)}${qBody(q, T.ans, T.res, 'rt')}
      <div class="btns"><button class="btn pri" data-ra="chk" ${T.res ? 'disabled' : ''}>✓ Prüfen</button><button class="btn" data-ra="hint" ${T.res ? 'disabled' : ''}>💡 Tipp</button><button class="btn" data-ra="next">${T.res ? 'Nächste Frage' : 'Überspringen'}</button></div>
      ${T.res ? resBlock(q, T.res, true) : ''}</div>`;
  }
  const rv = $('#rtView');
  rv.addEventListener('input', e => { if (e.target.dataset.in) S.tr_.ans.v = e.target.value; });
  rv.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in) { e.preventDefault(); trainerCheck(); } });
  rv.addEventListener('click', e => {
    const T = S.tr_, tc = e.target.closest('[data-tc]'), ra = e.target.closest('[data-ra]'), lv = e.target.closest('[data-lv]');
    if (lv) { T.level = +lv.dataset.lv; newTrainer(); return; }
    if (tc && !T.res) { T.ans.c = +tc.dataset.tc; renderTrainer(); return; }
    if (ra) { const a = ra.dataset.ra; if (a === 'chk') trainerCheck(); else if (a === 'hint') hintFor(T.q, 'rt'); else { if (!T.res && S.rt.streak) { S.rt.streak = 0; lsSet('rt', S.rt); } newTrainer(); updatePal(); } }
  });
  function trainerCheck() {
    const T = S.tr_; if (T.res) return; const e = evalQ(T.q, T.ans); if (!e) return;
    T.res = { ok: e.ok, given: e.given }; S.rt.n++; if (e.ok) { S.rt.ok++; S.rt.streak++; S.rt.best = Math.max(S.rt.best, S.rt.streak); ding(); } else { S.rt.streak = 0; sad(); }
    lsSet('rt', S.rt); renderTrainer(); updatePal();
  }

  /* ============================================================ Beispiele */
  function exBody(e) {
    const st = sane(e.tab, e.p), b = CALC[e.tab].build(st);
    return `<div class="inst">${stripH(b.viz)}</div>` + (b.hk ? `<div class="inst">${b.hk}</div>` : '') + b.out;
  }
  function renderBsp() {
    $('#bspView').innerHTML = `<p class="hint2" style="margin:0 0 8px">Fertig durchgerechnete Beispiele (Übungswerte). Mit „In den Rechner laden“ öffnest du die Zahlen im passenden Reiter und kannst sie verändern.</p>` + D.examples.map(e => `<div class="card pl" id="ex_${e.id}"><h4>Beispiel</h4><div class="big">${esc(e.title)}</div><p style="margin:4px 0 8px">${esc(e.text)}</p>${exBody(e)}<div class="btns"><button class="btn pri" data-ex="${e.id}">In den Rechner laden</button></div></div>`).join('');
  }
  function loadExample(x) { S[x.tab] = sane(x.tab, x.p); lsSet(x.tab, S[x.tab]); setTab(x.tab); }
  $('#bspView').addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b) return; const x = D.examples.find(z => z.id === b.dataset.ex); if (!x) return;
    loadExample(x); toast('Beispiel geladen: ' + x.title);
  });

  /* ============================================================ Hilfe */
  /* PRUEFEN P18: Der Hilfetext fasst die Formeln in eigenen Worten zusammen (Kräfte, Hebel, Träger, Schwerpunkt, Reibung, Spannung, Pressung, Biegung, Sicherheit, Arbeit). Reihenfolge und Tiefe für Industriemechaniker im ersten und zweiten Ausbildungsjahr: passt das, oder fehlt ein Stoffgebiet (z. B. Torsion, Knicken, Dauerfestigkeit)? */
  function renderHelp() {
    const sec = (t, b, open) => `<details${open ? ' open' : ''}><summary>${t}</summary><div class="hb2">${b}</div></details>`;
    $('#helpView').innerHTML =
      `<div class="rdout warn">⚠ ${esc(UEB)}</div>` +
      sec('Kraft als Vektor', `<p>Eine Kraft hat Betrag, Richtung und Angriffspunkt, man zeichnet sie als Pfeil. Zwei Kräfte am selben Punkt ersetzt man durch eine <b>Resultierende</b>: Im <b>Kräfteparallelogramm</b> ist sie die Diagonale, im <b>Kräfteeck</b> setzt man die Pfeile Spitze an Anfang.</p><span class="eq">Zerlegen: Fx = F · cos α, Fy = F · sin α</span><span class="eq">Zusammensetzen: R = √(ΣFx² + ΣFy²)</span><span class="eq">zwei Kräfte, Winkel γ dazwischen: R = √(F1² + F2² + 2 · F1 · F2 · cos γ)</span><span class="eq">Gewichtskraft: G = m · g, g = 9,81 m/s²</span><p>Bei einer Last an zwei Seilen gilt: Je flacher die Seile, desto größer ihre Kraft. Die senkrechten Anteile tragen zusammen die Last.</p>`) +
      sec('Hebel und Drehmoment', `<span class="eq">Drehmoment: M = F · l (Kraft senkrecht zum Hebelarm l)</span><span class="eq">Hebelgesetz im Gleichgewicht: F1 · l1 = F2 · l2</span><p>Das Drehmoment ist Kraft mal Hebelarm. Im Gleichgewicht ist die Summe aller Momente um den Drehpunkt gleich null (rechtsdrehend gegen linksdrehend). Rechne Hebelarme in Meter, wenn das Moment in Nm herauskommen soll. Das Lager am Drehpunkt trägt die Summe der Kräfte.</p>`) +
      sec('Träger auf zwei Stützen', `<p>Du ersetzt jede Last durch ihre Kraft (Streckenlast: q mal Länge, wirkt in der Mitte des belasteten Stücks) und stellst das <b>Momentengleichgewicht um ein Lager</b> auf. Daraus folgt die andere Auflagerkraft, die erste ergibt sich aus der Summe der Kräfte.</p><span class="eq">FB = (Σ Last · Abstand von A) / Stützweite</span><span class="eq">FA = ΣF − FB</span><p><b>Querkraft</b> V ist die Summe der Kräfte links vom Schnitt, sie springt an jeder Einzellast und Stütze. Das <b>Biegemoment</b> M ist am größten dort, wo die Querkraft null wird oder ihr Vorzeichen wechselt.</p>`) +
      sec('Schwerpunkt', `<span class="eq">xs = Σ(Ai · xi) / ΣAi, ys = Σ(Ai · yi) / ΣAi</span><p>Zerlege die Fläche in Rechtecke, Dreiecke und Kreise. Aussparungen (Bohrungen) zählen mit negativer Fläche. Das Dreieck hat den Schwerpunkt im Drittel der Höhe über der Grundlinie.</p>`) +
      sec('Reibung', `<span class="eq">Reibkraft: FR = μ · FN</span><span class="eq">schiefe Ebene: FH = G · sin α, FN = G · cos α</span><span class="eq">bleibt liegen, solange tan α ≤ μ0; Grenzwinkel ρ0 = arctan μ0</span><span class="eq">hinaufziehen: F = G · (sin α + μ · cos α)</span><table><tr><th>Werkstoffpaar</th><th>μ0 (Haften)</th><th>μ (Gleiten)</th></tr>${C.MU.map(m => `<tr><td>${esc(m.n)}</td><td>${f(m.mu0, 2)}</td><td>${f(m.mu, 2)}</td></tr>`).join('')}</table><p>Haftreibung ist größer als Gleitreibung. Der <b>Reibkegel</b> hat den halben Öffnungswinkel ρ0: Liegt die Wirkungslinie der Gewichtskraft im Kegel um die Flächennormale, rutscht der Körper nicht.</p>`) +
      sec('Spannung und Dehnung', `<span class="eq">Spannung: σ = F / A (N/mm²)</span><span class="eq">Dehnung: ε = ΔL / L</span><span class="eq">Hooke (elastisch): σ = E · ε, also ΔL = F · L / (E · A)</span><table><tr><th>Werkstoff</th><th>E in N/mm²</th><th>Re</th><th>Rm</th></tr>${C.MAT.map(m => `<tr><td>${esc(m.n)}</td><td>${f(m.E, 0)}</td><td>${fin(m.Re) ? f(m.Re, 0) : '–'}</td><td>${f(m.Rm, 0)}</td></tr>`).join('')}</table><p>Hooke gilt nur unterhalb der Streckgrenze. In den Zeichnungen ist die Verformung bewusst stark übertrieben, sonst sähe man sie nicht.</p>`) +
      sec('Flächenpressung und Abscheren', `<span class="eq">Pressung: p = F / (d · t) (projizierte Fläche)</span><span class="eq">Abscheren: τ = F / (n · A), A = π · d² / 4</span><span class="eq">Lochen: F = τaB · π · d · s, τaB ≈ 0,8 · Rm</span><p>Bei der Pressung drückt der Bolzen auf die Lochwand. Beim Abscheren wird der Bolzen in einer (einschnittig) oder zwei (zweischnittig) Ebenen durchtrennt.</p>`) +
      sec('Biegung, Sicherheit', `<span class="eq">Biegespannung: σb = Mb / W</span><span class="eq">Rechteck: W = b · h² / 6 (h in Lastrichtung)</span><span class="eq">Vollkreis: W = π · d³ / 32</span><span class="eq">Einzellast mittig: Mb = F · L / 4</span><span class="eq">Sicherheit: S = Grenzspannung / σ (zäh: Re, spröde: Rm)</span><p>Das Widerstandsmoment beschreibt, wie gut ein Querschnitt Biegung aufnimmt. Die Höhe geht quadratisch ein: Hochkant ist stärker als flach. Mb in Nmm und W in mm³ ergibt σ in N/mm².</p>`) +
      sec('Arbeit, Leistung, Wirkungsgrad', `<span class="eq">Arbeit: W = F · s (J = Nm), Hubarbeit W = m · g · h</span><span class="eq">Leistung: P = W / t = F · v</span><span class="eq">Drehbewegung: P = M · 2π · n (n in 1/s)</span><span class="eq">Wirkungsgrad: η = P_ab / P_zu, Stufen multiplizieren sich</span><p>Der Wirkungsgrad ist nie größer als 100 %; Verluste werden zu Wärme.</p>`) +
      `<p class="hint2">Zahlen und Begriffe sind Lehrbuch- und Übungswerte; Unsicheres ist im Quelltext mit PRUEFEN markiert.</p>`;
  }

  /* ============================================================ Reiter, Kopfzeile, Bedienleiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="tab${S.tab === k ? ' on' : ''}" id="tab-${k}" data-t="${k}" data-tab="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'kr'; S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (CALCS.indexOf(t) >= 0) renderCalc(t); else ({ tasks: renderTasks, rt: renderTrainer, bsp: renderBsp, help: renderHelp })[t]();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = 'Mechanik-Lab\n<small>' + esc(T[2]) + '</small>'; document.title = 'Mechanik-Lab: ' + T[2];
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
  $('#title').onclick = () => setTab('kr');
  $('#bMenu').onclick = () => {
    const rows = [['tasks', 'Aufgaben', TASKS.length + ' Aufgaben mit Prüfung und Tipps'], ['rt', 'Zufalls-Trainer', 'Unendlich viele Aufgaben mit Serien-Zähler'], ['bsp', 'Beispiele', 'Fertig durchgerechnete Beispiele zum Laden'], ['help', 'Hilfe und Formeln', 'Kräfte, Hebel, Träger, Reibung, Spannung, Biegung, Leistung'], ['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben und Trainer-Serie auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']];
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
  root.MCH_LAB = { id: 'mch', title: 'Mechanik-Lab', doneKey: LS + 'done', progKey: LS + 'prog', total: TASKS.length, done: () => Object.keys(done()).filter(k => TASKS.some(t => t.id === k)), tasks: root.MCH_TASKS };

  /* Rauchtest für quelle/mch/test_mchcore.js (läuft nur, wenn der Test window.__MCH_TEST setzt) */
  root.MCH_UI = {
    smoke: function () {
      if (!root.__MCH_TEST) return 'nur im Test';
      try {
        TABS.forEach(t => setTab(t[0]));
        TASKS.forEach(t => {
          setTab('tasks'); startTask(t.id); const q = S.tq;
          S.tAns[t.id] = {}; checkTask(t);
          S.tAns[t.id] = D.wrongAns(q); checkTask(t); renderTasks(false);
          S.tAns[t.id] = D.solAns(q); S.tRes = null; checkTask(t);
          if (!S.tRes || !S.tRes.ok) throw new Error('Aufgabe ' + t.id + ': Musterlösung wird in der Oberfläche nicht akzeptiert');
          renderTasks(false); hintFor(q, t.id);
        });
        S.tr_.level = 0; for (let k = 0; k < 60; k++) { newTrainer(); const q = S.tr_.q; S.tr_.ans = D.solAns(q); trainerCheck(); renderTrainer(); }
        D.examples.forEach(e => { loadExample(e); if (!exBody(e)) throw new Error('Beispiel ' + e.id + ' leer'); });
        /* Rechner mit gültigen, extremen und ungültigen Eingaben */
        const probes = { kr: [{ mode: 'comp', F1: '0', F2: '0' }, { mode: 'comp', F1: 'x' }, { mode: 'comp', show: 'eck', F1: '90', a1: '-120', F2: '90', a2: '170' }, { mode: 'zerl', F: '0' }, { mode: 'zerl', F: '180', a: '90' }, { mode: 'zerl', F: '-5' }], he: [{ F1: '0', F2: '0' }, { F1: '1000', x1: '100', F2: '1', x2: '100' }, { F1: 'a' }, { F1: '300', x1: '20', F2: '200', x2: '30' }], tr: [{ L: '0' }, { L: '5', a: '1', b: '4' }, { F1: '0', q: '0' }, { L: '6', a: '1', b: '5', F1: '1000', x1: '0', q: '400', q1: '5', q2: '1' }, { L: '3', a: '0', b: '3', F1: '500', x1: '7' }, { L: '4', a: '0', b: '1', F1: '500', x1: '3.9' }], rb: [{ alpha: '0' }, { alpha: '60', m: '0' }, { alpha: '75' }, { alpha: 'q' }, { mat: 'gb', alpha: '45' }], sp: [{ sub: 'zug', F: '0' }, { sub: 'zug', F: '999999' }, { sub: 'zug', prof: 'rechteck', dr: 'druck' }, { sub: 'zug', d: '0' }, { sub: 'zug', mat: 'gj' }, { sub: 'bieg', bprof: 'kreis' }, { sub: 'bieg', bprof: 'rohr', bD: '20', bdi: '30' }, { sub: 'bieg', bprof: 'rohr', bD: '40', bdi: '0' }, { sub: 'bieg', bL: '0' }], fp: [{ sub: 'press', t: '0' }, { sub: 'schub', n: '2' }, { sub: 'schub', Rm: '0' }, { sub: 'loch', s: '0' }, { sub: 'loch', d: '30', s: '11' }], wt: [{ sub: 'sw', B: '0' }, { sub: 'sw', B: '300', t1: '100', t2: '100', H: '300' }, { sub: 'ar', e1: '120' }, { sub: 'ar', t: '0' }, { sub: 'ar', e1: '100', e2: '100' }] };
        Object.keys(probes).forEach(tab => probes[tab].forEach(pr => { S[tab] = sane(tab, Object.assign({}, DEF[tab], pr)); setTab(tab); updateCalc(tab); syncIn(tab); }));
        /* Ziehen */
        S.kr = sane('kr', {}); [['F1', { x: 300, y: 120 }], ['F2', { x: 100, y: 300 }], ['F', { x: 400, y: 100 }], ['F1', { x: V.KO.x, y: V.KO.y }]].forEach(a => { dragKr(a[0], a[1]); });
        S.kr.show = 'eck'; dragKr('F2', { x: 400, y: 100 }); S.he = sane('he', {}); dragHe('x1', { x: 100, y: 150 }); dragHe('x2', { x: 560, y: 150 }); S.tr = sane('tr', {}); ['F1', 'F2', 'q1', 'q2'].forEach(id => dragTr(id, { x: 300, y: 40 })); S.rb = sane('rb', {}); dragRb('alpha', { x: 300, y: 100 }); dragRb('alpha', { x: 300, y: 400 });
        if (dragKr('zz', { x: 0, y: 0 }) || dragHe('zz', { x: 0, y: 0 }) || dragTr('zz', { x: 0, y: 0 }) || dragRb('zz', { x: 0, y: 0 })) throw new Error('unbekannter Ziehpunkt wird angenommen');
        CALCS.forEach(t => { S[t] = sane(t, DEF[t]); });
        setTab('bsp'); setTab('help'); return 'ok';
      } catch (e) { return e && e.stack ? e.stack : String(e); }
    }
  };

  buildTabs(); updatePal(); setTab(TABS.some(x => x[0] === S.tab) ? S.tab : 'kr');
  /* Aufruf ?aufgabe=mch1 (Startseite, Lernhefte) öffnet die Aufgabe, ?bsp die Beispiele (?bsp=kr1 springt zu einem Beispiel) */
  root.LabGoto = id => { try { if (TASKS.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };
  try {
    const qp = new URLSearchParams(location.search), qa = qp.get('aufgabe');
    if (qa && TASKS.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); }
    else if (qp.has('bsp')) { setTab('bsp'); const el = $('#ex_' + (qp.get('bsp') || '').replace(/[^a-z0-9_]/gi, '')); if (el) el.scrollIntoView(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
