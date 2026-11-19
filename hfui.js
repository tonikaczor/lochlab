'use strict';
/* Tonfunk Lab "Funk- und HF-Lab": Oberfläche (Lab-Kennung 'hf').
   Reiter: Pegel, Leitung, Funkstrecke, Modulation, Empfänger, Messen (je Erklärung + Visualisierung), Aufgaben (?aufgabe=hf1), Hilfe.
   Module: hfcore.js (HF_CORE), hfdata.js (HF_DATA, HF_TASKS), hfviz.js (HF_VIZ: Zeichnen und Modelle).
   Speicher (Präfix lm4.hf.): tab, lab (Reglerstände), done ({id:true}), prog ({id:Prozent}), hints ({id:höchste Stufe}),
   ctipps ({id:Stufe} nur im Prüfmodus), exam ('1' = Prüfmodus), filter (Aufgabenfilter).
   Tipps: drei Stufen; im Prüfmodus kostet jede Stufe 25 % der Punkte, sonst nichts.
   Die HTML-Bausteine (window.HF_UIX) sind reine Funktionen und werden ohne Browser geprüft (test_hfviz.js). */
(function (root) {
  const C = root.HF_CORE || (typeof require === 'function' ? require('./hfcore.js') : null);
  const D = root.HF_DATA || (typeof require === 'function' ? require('./hfdata.js') : null);
  const V = root.HF_VIZ || (typeof require === 'function' ? require('./hfviz.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = 'lm4.hf.';
  const NAME = 'Funk- und HF-Lab';
  const hasDoc = typeof document !== 'undefined' && document.querySelector;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const dots = l => '●'.repeat(l || 1) + '○'.repeat(3 - (l || 1));
  const reduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const num = v => typeof v === 'number' && isFinite(v);
  const inR = (v, a, b) => num(v) && v >= a && v <= b;

  /* ============================================================ Zustand (Voreinstellungen) */
  const defaults = () => ({
    peg: { db: 3, l: 0 },
    ltg: { rl: 100, ph: 0 },
    ant: { ptx: 20, gv: 0, ad: 0, ktx: 2, gtx: 5, d: 5, f: 868, grx: 2, krx: 1, sens: -105 },
    mod: { kind: 'am', fc: 1000, fm: 100, m: 0.6, df: 200, rb: 200, n: 4, h: 1 },
    rx: { b: 12500, nf: 6, snr: 10, pin: -100 },
    mes: { f0: 10.7e6, q: 50, dv: 2 }
  });
  const S = { tab: 'peg', lab: defaults(), t: null, filter: '', play: null };
  const TABS = [['peg', '📏', 'Pegel'], ['ltg', '➰', 'Leitung'], ['ant', '📡', 'Funkstrecke'], ['mod', '〰️', 'Modulation'], ['rx', '📻', 'Empfänger'], ['mes', '🔬', 'Messen'], ['tasks', '📝', 'Aufgaben'], ['help', '📘', 'Hilfe']];
  const LABTABS = ['peg', 'ltg', 'ant', 'mod', 'rx', 'mes'];
  const BLOCK = id => D.blocks.find(b => b.id === id);

  /* ============================================================ Bausteine für Bedienelemente */
  const rg = (id, label, min, max, step, val, disp, extra) => `<label class="rg" for="${id}"><span class="lb">${esc(label)}</span><output class="vl" id="${id}_o" for="${id}">${esc(disp)}</output><input type="range" id="${id}" data-rg="${id}" min="${min}" max="${max}" step="${step}" value="${val}"${extra || ''}></label>`;
  const seg = (name, label, items, cur) => `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${name}">${items.map(([k, l]) => `<button type="button" class="${String(cur) === String(k) ? 'on' : ''}" data-k="${esc(k)}" aria-pressed="${String(cur) === String(k)}">${esc(l)}</button>`).join('')}</div>`;
  const chips = (label, items) => `<div class="chiprow" role="group" aria-label="${esc(label)}">${items.map(([k, l]) => `<button type="button" class="chip" data-chip="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
  const cvs = (key, label, pri) => `<canvas id="cv_${key}" class="cv${pri ? ' pri' : ''}" role="img" aria-label="${esc(label)}"></canvas>`;
  const STATUS = '<div id="status" class="status" hidden></div>', RO = '<div id="readout"></div>';
  const hz = f => C.fmtHz(f, 3);
  const db = (v, u) => C.fmt(v, 4) + ' ' + (u || 'dB');
  /* logarithmische Regler: Wert = log10(x), auf drei geltende Stellen gerundet */
  const lg = x => Math.log10(x).toFixed(3);
  const fromLg = v => { const f = Math.pow(10, +v), e = Math.pow(10, Math.floor(Math.log10(f)) - 2); return +(Math.round(f / e) * e).toPrecision(3); };

  /* ============================================================ Reiter-Beschreibungen */
  const TAB = {};

  /* ---- 1 Pegel und Dezibel ---- */
  const PEGP = { p3: ['+3 dB', 3], p6: ['+6 dB', 6], p10: ['+10 dB', 10], p20: ['+20 dB', 20], m3: ['−3 dB', -3], m10: ['−10 dB', -10], m20: ['−20 dB', -20] };
  TAB.peg = {
    cv: ['fac'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Merkzahlen', Object.keys(PEGP).map(k => [k, PEGP[k][0]]))}
      ${rg('pDb', 'Pegeländerung', -40, 40, 0.5, s.db, C.fmtSgn(s.db, 3) + ' dB')}
      <div class="mini">Pegelrechner: Was bedeutet ein Pegel in dBm?</div>${rg('pL', 'Leistungspegel', -120, 50, 1, s.l, db(s.l, 'dBm'))}</div>`,
      plots: `${cvs('fac', 'Faktor für Leistung und Spannung über der Pegeländerung in dB', 1)}${STATUS}${RO}` }),
    ranges: { pDb: (s, v) => { s.db = +v; return C.fmtSgn(s.db, 3) + ' dB'; }, pL: (s, v) => { s.l = +v; return db(s.l, 'dBm'); } },
    segs: {},
    chips: (s, k) => { const p = PEGP[k]; if (!p) return false; s.db = p[1]; return true; },
    valid: s => inR(s.db, -40, 40) && inR(s.l, -120, 50),
    model: s => V.MODELS.peg(s),
    status: (m, s) => ({ cls: 'info', text: s.db === 0 ? '0 dB: Nichts ändert sich, beide Faktoren sind 1.' : `${C.fmtSgn(s.db, 3)} dB: Faktor ${C.fmt(m.kp, 4)} bei der Leistung, Faktor ${C.fmt(m.ku, 4)} bei der Spannung. ${s.db > 0 ? 'Das ist eine Verstärkung.' : 'Das ist eine Dämpfung.'} Für denselben Faktor braucht die Spannung doppelt so viele dB.` })
  };

  /* ---- 2 Leitung und Anpassung ---- */
  const LTGP = { ang: ['Angepasst 50 Ω', 50], r75: ['75 Ω', 75], r25: ['25 Ω', 25], r150: ['150 Ω', 150], kurz: ['Kurzschluss', 0], offen: ['Offen', 1e9] };
  const ohm = r => r <= 0 ? 'Kurzschluss (0 Ω)' : r >= 1e6 ? 'offen' : C.fmt(r, 3) + ' Ω';
  const lgR = r => lg(Math.min(2500, Math.max(1, r)));
  TAB.ltg = {
    cv: ['wave'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Abschluss', Object.keys(LTGP).map(k => [k, LTGP[k][0]]))}
      ${rg('lR', 'Abschlusswiderstand (Leitung: 50 Ω)', 0, 3.4, 0.01, lgR(s.rl), ohm(s.rl))}
      <div class="nrow">${rg('lPh', 'Zeitpunkt in der Periode', 0, 0.98, 0.02, s.ph, Math.round(s.ph * 100) + ' %')}${reduced() ? '' : '<button type="button" class="btn" data-act="play" id="ltPlay">▶ Welle laufen lassen</button>'}</div></div>`,
      plots: `${cvs('wave', 'Hinlaufende, rücklaufende und stehende Welle auf der Leitung', 1)}${STATUS}${RO}` }),
    ranges: { lR: (s, v) => { s.rl = fromLg(v); return ohm(s.rl); }, lPh: (s, v) => { s.ph = +v; return Math.round(s.ph * 100) + ' %'; } },
    segs: {},
    chips: (s, k) => { const p = LTGP[k]; if (!p) return false; s.rl = p[1]; return true; },
    valid: s => num(s.rl) && s.rl >= 0 && inR(s.ph, 0, 1),
    model: s => V.MODELS.ltg(s),
    status: (m) => { const a = Math.abs(m.r);
      if (a < 0.005) return { cls: 'ok', icon: '✓', text: 'Angepasst: Es läuft nichts zurück. Die Spannung ist überall gleich groß, es gibt keine stehende Welle.' };
      if (a > 0.995) return { cls: 'bad', icon: '⚠', text: 'Totalreflexion: Die ganze Leistung läuft zurück. In den Knoten ist die Spannung null, in den Bäuchen doppelt so groß.' };
      if (m.swr <= 1.5) return { cls: 'ok', icon: '✓', text: `Gute Anpassung: s = ${C.fmt(m.swr, 3)}. Nur ${C.fmt(m.rf, 3)} % der Leistung laufen zurück.` };
      if (m.swr <= 3) return { cls: 'warn', icon: '⚠', text: `Mäßige Anpassung: s = ${C.fmt(m.swr, 3)}. ${C.fmt(m.rf, 3)} % der Leistung laufen zurück.` };
      return { cls: 'bad', icon: '⚠', text: `Schlechte Anpassung: s = ${C.fmt(m.swr, 3)}. ${C.fmt(m.rf, 3)} % der Leistung laufen zurück. Viele Sender regeln dann die Leistung herunter.` }; }
  };

  /* ---- 3 Antenne und Funkstrecke ---- */
  const km = d => d < 1 ? C.fmt(d * 1000, 3) + ' m' : C.fmt(d, 3) + ' km';
  const ANTP = { lora: ['Sensor 868 MHz', { ptx: 14, gv: 0, ad: 0, ktx: 0, gtx: 2, d: 3, f: 868, grx: 2, krx: 0, sens: -120 }], wlan: ['WLAN 2,4 GHz', { ptx: 17, gv: 0, ad: 0, ktx: 1, gtx: 3, d: 0.1, f: 2400, grx: 3, krx: 1, sens: -75 }], sprech: ['Sprechfunk 145 MHz', { ptx: 37, gv: 0, ad: 0, ktx: 2, gtx: 5, d: 30, f: 145, grx: 2, krx: 1, sens: -115 }], richt: ['Richtfunk 2,4 GHz', { ptx: 20, gv: 0, ad: 0, ktx: 2, gtx: 20, d: 10, f: 2400, grx: 20, krx: 2, sens: -80 }] };
  TAB.ant = {
    cv: ['plan'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Beispiele', Object.keys(ANTP).map(k => [k, ANTP[k][0]]))}
      <div class="mini">Frequenz</div>${seg('f', 'Frequenz', [[145, '145 MHz'], [433, '433 MHz'], [868, '868 MHz'], [2400, '2,4 GHz']], s.f)}
      ${rg('aD', 'Entfernung', -2, 2, 0.01, lg(s.d), km(s.d))}
      <fieldset class="sigrow"><legend>Sendeseite</legend>${rg('aP', 'Sender', 0, 47, 1, s.ptx, db(s.ptx, 'dBm'))}${rg('aGv', 'Verstärker', 0, 30, 1, s.gv, db(s.gv))}${rg('aAd', 'Dämpfungsglied', 0, 20, 1, s.ad, db(s.ad))}${rg('aKt', 'Kabel', 0, 10, 0.5, s.ktx, db(s.ktx))}${rg('aGt', 'Antennengewinn', 0, 24, 0.5, s.gtx, db(s.gtx, 'dBi'))}</fieldset>
      <fieldset class="sigrow"><legend>Empfangsseite</legend>${rg('aGr', 'Antennengewinn', 0, 24, 0.5, s.grx, db(s.grx, 'dBi'))}${rg('aKr', 'Kabel', 0, 10, 0.5, s.krx, db(s.krx))}${rg('aS', 'Empfindlichkeit', -130, -60, 1, s.sens, db(s.sens, 'dBm'))}</fieldset></div>`,
      plots: `${cvs('plan', 'Pegelplan der Funkstrecke als Treppe', 1)}${STATUS}${RO}` }),
    ranges: { aD: (s, v) => { s.d = fromLg(v); return km(s.d); }, aP: (s, v) => { s.ptx = +v; return db(s.ptx, 'dBm'); }, aGv: (s, v) => { s.gv = +v; return db(s.gv); }, aAd: (s, v) => { s.ad = +v; return db(s.ad); }, aKt: (s, v) => { s.ktx = +v; return db(s.ktx); }, aGt: (s, v) => { s.gtx = +v; return db(s.gtx, 'dBi'); }, aGr: (s, v) => { s.grx = +v; return db(s.grx, 'dBi'); }, aKr: (s, v) => { s.krx = +v; return db(s.krx); }, aS: (s, v) => { s.sens = +v; return db(s.sens, 'dBm'); } },
    segs: { f: (s, k) => { s.f = +k; return false; } },
    chips: (s, k) => { const p = ANTP[k]; if (!p) return false; Object.assign(s, p[1]); return true; },
    valid: s => inR(s.ptx, 0, 47) && inR(s.gv, 0, 30) && inR(s.ad, 0, 20) && inR(s.ktx, 0, 10) && inR(s.gtx, 0, 24) && inR(s.d, 0.01, 100) && [145, 433, 868, 2400].includes(s.f) && inR(s.grx, 0, 24) && inR(s.krx, 0, 10) && inR(s.sens, -130, -60),
    model: s => V.MODELS.ant(s),
    status: (m) => m.mar >= 10 ? { cls: 'ok', icon: '✓', text: `Die Strecke steht sicher: ${C.fmt(m.mar, 3)} dB Reserve über der Empfindlichkeit.` } : m.mar >= 0 ? { cls: 'warn', icon: '⚠', text: `Knapp: nur ${C.fmt(m.mar, 3)} dB Reserve. Schwund, Regen oder ein Hindernis können die Verbindung unterbrechen. Plane mindestens 10 dB ein.` } : { cls: 'bad', icon: '⚠', text: `Keine Verbindung: Es fehlen ${C.fmt(-m.mar, 3)} dB. Mehr Antennengewinn, weniger Kabeldämpfung oder eine kürzere Strecke helfen.` }
  };

  /* ---- 4 Modulation ---- */
  TAB.mod = {
    cv: ['time', 'spec'],
    html: s => { const dm = V.dfMax(s.fc); if (s.df > dm) s.df = dm; const dig = s.kind === 'ask' || s.kind === 'fsk';
      return { ctl: `<div class="ctlbox">${seg('kind', 'Modulationsart', [['am', 'AM'], ['fm', 'FM'], ['ask', 'ASK'], ['fsk', 'FSK']], s.kind)}
      ${dig ? rg('mRb', 'Bitrate', 100, 1200, 100, s.rb, s.rb + ' bit/s') + rg('mN', 'Trägerschwingungen je Bit', 3, 8, 1, s.n, String(s.n)) + (s.kind === 'fsk' ? rg('mH', 'Frequenzabstand geteilt durch Bitrate (h)', 0.5, 4, 0.5, s.h, C.fmt(s.h, 2)) : '') + '<div class="mini">Gesendet wird die feste Bitfolge 1 0 1 1 0 0 1 0.</div>'
        : rg('mFc', 'Trägerfrequenz f_T', 500, 2000, 100, s.fc, s.fc + ' Hz') + rg('mFm', 'Modulationsfrequenz f_m', 50, 300, 10, s.fm, s.fm + ' Hz') + (s.kind === 'am' ? rg('mM', 'Modulationsgrad m', 0, 150, 5, Math.round(s.m * 100), Math.round(s.m * 100) + ' %') : rg('mDf', 'Frequenzhub Δf (höchstens 40 % von f_T)', 10, dm, 10, s.df, s.df + ' Hz'))}
      <div class="mini">Die Frequenzen sind klein gewählt, damit du die einzelnen Schwingungen siehst. Bei echtem Funk sind es MHz, das Prinzip ist gleich.</div></div>`,
      plots: `${cvs('time', 'Modulierte Schwingung im Zeitbereich', 1)}${STATUS}${cvs('spec', 'Spektrum der modulierten Schwingung')}${RO}` }; },
    ranges: { mFc: (s, v) => { s.fc = +v; const mx = V.dfMax(s.fc), el = hasDoc && $('#mDf'); if (s.df > mx) s.df = mx; if (el) { el.max = mx; el.value = s.df; const o = $('#mDf_o'); if (o) o.textContent = s.df + ' Hz'; } return s.fc + ' Hz'; }, mFm: (s, v) => { s.fm = +v; return s.fm + ' Hz'; }, mM: (s, v) => { s.m = +v / 100; return Math.round(s.m * 100) + ' %'; }, mDf: (s, v) => { s.df = Math.min(+v, V.dfMax(s.fc)); return s.df + ' Hz'; },
      mRb: (s, v) => { s.rb = +v; return s.rb + ' bit/s'; }, mN: (s, v) => { s.n = +v; return String(s.n); }, mH: (s, v) => { s.h = +v; return C.fmt(s.h, 2); } },
    segs: { kind: (s, k) => { s.kind = k; return true; } },
    valid: s => ['am', 'fm', 'ask', 'fsk'].includes(s.kind) && inR(s.fc, 500, 2000) && inR(s.fm, 50, 300) && inR(s.m, 0, 1.5) && inR(s.df, 10, 800) && inR(s.rb, 100, 1200) && inR(s.n, 3, 8) && inR(s.h, 0.5, 4),
    model: s => V.MODELS.mod(s),
    status: (m, s) => s.kind === 'am' ? (s.m > 1 ? { cls: 'bad', icon: '⚠', text: 'Übermodulation (m über 100 %): Die Hüllkurve geht durch null und wird verzerrt. Der Sender stört dann auch Nachbarkanäle.' } : { cls: 'ok', icon: '✓', text: `Keine Übermodulation. Das Signal belegt ${hz(m.bw)}: zweimal die Modulationsfrequenz.` })
      : s.kind === 'fm' ? { cls: 'info', text: `η = ${C.fmt(s.df / s.fm, 3)}: ${s.df / s.fm < 0.5 ? 'Schmalband-FM, im Spektrum fast wie AM (Träger und zwei Seitenlinien).' : 'Viele Seitenlinien im Abstand f_m. Die Amplitude bleibt gleich, nur die Frequenz schwankt.'} Nach Carson werden ${hz(m.bw)} gebraucht.` }
      : s.kind === 'ask' ? { cls: 'info', text: `ASK: Bei einer 1 ist der Träger an, bei einer 0 aus. Die Hauptkeule im Spektrum ist ${hz(m.bw)} breit: zweimal die Bitrate.` }
      : { cls: 'info', text: `FSK: Bit 0 und Bit 1 haben verschiedene Frequenzen, die Amplitude bleibt gleich. ${s.h < 1 ? 'Bei kleinem Abstand verschmelzen die beiden Keulen.' : 'Bei großem Abstand siehst du zwei getrennte Keulen.'}` }
  };

  /* ---- 5 Empfänger und Rauschen ---- */
  const RXP = { cw: ['Telegrafie 500 Hz', 500], ssb: ['Sprache 2,7 kHz', 2700], nfm: ['FM-Kanal 12,5 kHz', 12500], ukw: ['Rundfunk 200 kHz', 200000], wlan: ['WLAN 20 MHz', 2e7] };
  TAB.rx = {
    cv: ['lev'],
    html: s => ({ ctl: `<div class="ctlbox">${chips('Bandbreiten', Object.keys(RXP).map(k => [k, RXP[k][0]]))}
      ${rg('rB', 'Bandbreite B', 2, 7.3, 0.01, lg(s.b), hz(s.b))}${rg('rNf', 'Rauschmaß F', 0, 15, 0.5, s.nf, db(s.nf))}${rg('rSn', 'Nötiger Signal-Rausch-Abstand', 0, 30, 1, s.snr, db(s.snr))}${rg('rP', 'Eingangspegel', -140, -40, 1, s.pin, db(s.pin, 'dBm'))}</div>`,
      plots: `${cvs('lev', 'Rauschboden, Empfindlichkeit und Eingangspegel über der Bandbreite', 1)}${STATUS}${RO}` }),
    ranges: { rB: (s, v) => { s.b = Math.min(V.BMAX, Math.max(V.BMIN, fromLg(v))); return hz(s.b); }, rNf: (s, v) => { s.nf = +v; return db(s.nf); }, rSn: (s, v) => { s.snr = +v; return db(s.snr); }, rP: (s, v) => { s.pin = +v; return db(s.pin, 'dBm'); } },
    segs: {},
    chips: (s, k) => { const p = RXP[k]; if (!p) return false; s.b = p[1]; return true; },
    valid: s => inR(s.b, 100, 2e7) && inR(s.nf, 0, 15) && inR(s.snr, 0, 30) && inR(s.pin, -140, -40),
    model: s => V.MODELS.rx(s),
    status: (m) => m.mar >= 0 ? { cls: 'ok', icon: '✓', text: `Empfang möglich: Das Signal liegt ${C.fmt(m.act, 3)} dB über dem Rauschboden, ${C.fmt(m.mar, 3)} dB mehr als nötig.` } : m.act > 0 ? { cls: 'warn', icon: '⚠', text: `Zu schwach: Das Signal liegt zwar ${C.fmt(m.act, 3)} dB über dem Rauschboden, dem Demodulator fehlen aber ${C.fmt(-m.mar, 3)} dB. Eine kleinere Bandbreite hilft.` } : { cls: 'bad', icon: '⚠', text: `Das Signal geht im Rauschen unter: Es liegt ${C.fmt(-m.act, 3)} dB unter dem Rauschboden.` }
  };

  /* ---- 6 Messen: Durchlasskurve ---- */
  const MESF = [[455e3, '455 kHz'], [10.7e6, '10,7 MHz'], [21.4e6, '21,4 MHz'], [433.92e6, '433,92 MHz']];
  const pct = v => C.fmtSgn(v, 3) + ' %';
  TAB.mes = {
    cv: ['res'],
    html: s => ({ ctl: `<div class="ctlbox"><div class="mini">Mittenfrequenz f₀</div>${seg('f0', 'Mittenfrequenz', MESF, s.f0)}
      ${rg('qQ', 'Güte Q', 10, 200, 5, s.q, C.fmt(s.q, 3))}${rg('qD', 'Messfrequenz: Abstand von f₀', -10, 10, 0.1, s.dv, pct(s.dv))}</div>`,
      plots: `${cvs('res', 'Durchlasskurve des Filters mit den beiden Punkten bei minus 3 dB', 1)}${STATUS}${RO}` }),
    ranges: { qQ: (s, v) => { s.q = +v; return C.fmt(s.q, 3); }, qD: (s, v) => { s.dv = +v; return pct(s.dv); } },
    segs: { f0: (s, k) => { s.f0 = +k; return false; } },
    valid: s => MESF.some(x => x[0] === s.f0) && inR(s.q, 10, 200) && inR(s.dv, -10, 10),
    model: s => V.MODELS.mes(s),
    status: (m) => m.fmess >= m.fu && m.fmess <= m.fo ? { cls: 'ok', icon: '✓', text: `Die Messfrequenz liegt im Durchlassbereich (zwischen den beiden −3-dB-Punkten). Bandbreite: ${hz(m.bw)}.` } : { cls: 'info', text: `Die Messfrequenz liegt außerhalb des Durchlassbereichs: Das Filter dämpft sie um ${C.fmt(-m.adb, 3)} dB. Eine höhere Güte macht das Filter schmaler.` }
  };

  /* ============================================================ Anzeige: Messwerte und Erklärung */
  function fv(m) {
    if (m.t) return m.t;
    const one = v => v == null || !isFinite(v) ? 'nicht bestimmbar' : m.u === 'Hz' ? C.fmtHz(v, 4) : m.u === 'W' ? C.fmtW(v, 4) : m.u === 'V' ? C.fmtV(v, 4) : m.u === 'm' ? C.fmtM(v, 4) : C.fmt(v, 4) + (m.u ? ' ' + m.u : '');
    return Array.isArray(m.v) ? m.v.map(one).join(' und ') : one(m.v);
  }
  const readout = metrics => `<div class="mets" role="list">${metrics.map(m => `<div class="met" role="listitem"><span class="k">${esc(m.k)}</span><b class="v">${esc(fv(m))}</b>${m.f ? `<small>${esc(m.f)}</small>` : ''}</div>`).join('')}</div>`;
  const more = b => `<details class="more"><summary>Erklärung: ${esc(b.title)}</summary><div class="mb">${b.more.map(([h, t]) => `<h4>${esc(h)}</h4><p>${esc(t)}</p>`).join('')}</div></details>`;
  const intro = b => `<div class="card pl intro"><h2 class="big">${esc(b.icon)} ${esc(b.title)}</h2><p>${esc(b.intro)}</p></div>`;
  function labHTML(tab, lab) {
    const b = BLOCK(tab), T = TAB[tab], s = lab[tab];
    const n = D.tasks.filter(t => t.cat === b.cat).length;
    const h = T.html(s);
    return `${intro(b)}<div class="card viz"><div class="vz"><div class="plots">${h.plots}</div><div class="ctl">${h.ctl}</div></div></div>${more(b)}<div class="btns"><button type="button" class="btn pri" data-act="goTasks">📝 ${n} Aufgaben zu diesem Block</button></div>`;
  }

  /* ============================================================ Aufgaben (HTML-Bausteine) */
  const exam = () => lsGet('exam', '0') === '1';
  const done = () => lsGet('done', {});
  const nDone = () => Object.keys(done()).filter(k => D.tasks.some(t => t.id === k)).length;
  function taskHTML(ctx) {
    const q = ctx.q, r = ctx.res, locked = !!(r && (r.ok || r.shown));
    let h = `<p class="qtext">${esc(q.text)}</p>`;
    h += `<label class="f"><span>${esc(q.label)}${q.unit ? ' in ' + esc(q.unit) : ''}</span><div class="qin"><input data-v id="tkIn" inputmode="decimal" autocomplete="off" value="${esc(ctx.ans || '')}"${locked ? ' disabled' : ''} aria-describedby="tkRule"><span class="u">${esc(q.unit)}</span></div></label>`;
    h += `<p class="hint2 lr-hinweis" id="tkRule">Komma oder Punkt als Dezimalzeichen. Erlaubte Abweichung: ±${esc(C.fmt(q.tol, 2))}${q.unit ? ' ' + esc(q.unit) : ''}. Tausenderpunkte sind bei der Eingabe nicht nötig.</p>`;
    h += `<div class="btns"><button type="button" class="btn pri" data-a="chk"${locked ? ' disabled' : ''}>✓ Prüfen</button><button type="button" class="btn" data-a="hint"${locked ? ' disabled' : ''}>💡 Tipp</button></div>`;
    if (r && !r.empty) {
      const msg = r.shown ? 'Lösung angezeigt (zählt nicht als gelöst).' : r.ok ? 'Richtig: ' + C.fmt(r.x, 5) + (q.unit ? ' ' + q.unit : '') : 'Deine Antwort „' + C.fmt(r.x, 5) + (q.unit ? ' ' + q.unit : '') + '“ stimmt nicht.';
      /* erster Fehlversuch = Tipp und zweiter Versuch, zweiter = Lösung mit Rechenweg; im Prüfmodus bleibt es beim Prüfmodus */
      const nt = ctx.tries || 0, fbc = r.ok ? 'ok' : (r.shown || (!exam() && nt >= 2)) ? 'loes' : 'tipp';
      let ex = '';
      if (r.ok || r.shown) ex = solutionHTML(q);
      else if (exam()) ex = '<div class="rdout bad">🎓 Prüfmodus: Die Musterlösung gibt es erst nach richtiger Lösung. Nutze einen Tipp oder versuche es noch einmal.</div>';
      else if (nt >= 2) ex = '<p><b>Lösung mit Rechenweg:</b> Diese Lösung zählt nicht als gelöst. Rechne den Weg nach und probiere „Neue Zahlen“.</p>' + solutionHTML(q);
      else ex = `<p><b>Tipp:</b> ${esc(q.tips[0])} Du hast einen zweiten Versuch.</p>`;
      h += `<div class="lr-fb ${fbc}" id="tkFb" role="status"><ul class="tl"><li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(msg)}</li></ul>${ex}</div>`;
    }
    if (!locked && !exam()) h += `<div class="btns"><button type="button" class="btn" data-a="show">👁 Musterlösung ansehen</button></div>`;
    return h;
  }
  function solutionHTML(q) { return `<div class="rdout ok"><b>Musterlösung mit Rechenweg</b><ol class="steps">${q.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="res">Ergebnis: <b>${esc(C.fmt(q.value, 5))}${q.unit ? ' ' + esc(q.unit) : ''}</b></p></div>`; }
  function tipHTML(q, n) {
    let x = '';
    for (let i = 0; i < n; i++) x += `<p><b>Stufe ${i + 1}${['', ' (Formel)', ' (eingesetzt)'][i]}:</b> ${esc(q.tips[i])}</p>`;
    x += n < 3 ? `<p class="hint2">Noch mehr Hilfe? Tippe noch einmal auf „Tipp“ für Stufe ${n + 1} von 3.</p>` : '';
    x += exam() ? '<p class="hint2 warn">Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>' : '<p class="hint2">Beim normalen Üben kosten Tipps nichts. Im Prüfmodus (🎓) zählen sie.</p>';
    return x;
  }
  function taskListHTML(filter, d, prog) {
    let h = `<div class="chiprow filt" role="group" aria-label="Block wählen">${[['', 'Alle']].concat(D.CATS.map(c => [c, c])).map(([k, l]) => `<button type="button" class="chip${filter === k ? ' on' : ''}" data-f="${esc(k)}" aria-pressed="${filter === k}">${esc(l)}</button>`).join('')}</div>`;
    let last = '';
    D.tasks.filter(t => !filter || t.cat === filter).forEach(x => { if (x.cat !== last) { last = x.cat; h += `<div class="gh">${esc(x.cat)}</div>`; } const p = prog[x.id]; h += `<button type="button" class="row" data-t="${esc(x.id)}"><span class="dot ${d[x.id] ? 'g' : p > 0 ? 'p' : ''}" aria-hidden="true">${d[x.id] ? '✓' : ''}</span><span class="grow"><b>${esc(x.title)}</b><small><span class="lv" aria-label="Stufe ${x.level} von 3">${dots(x.level)}</span>${p != null && !d[x.id] ? ' · bisher ' + p + ' %' : ''}${d[x.id] ? ' · gelöst' : ''}</small></span></button>`; });
    return h;
  }
  /* ============================================================ Hilfe */
  function helpHTML() {
    const rows = [1, 3, 6, 10, 20, 30, 40].map(x => `<tr><th>${esc(C.fmt(x, 3))} dB</th><td>${esc(C.fmt(C.ratioP(x), 4))}</td><td>${esc(C.fmt(C.ratioU(x), 4))}</td><td>${esc(C.fmt(C.ratioP(-x), 3))}</td><td>${esc(C.fmt(C.ratioU(-x), 3))}</td></tr>`).join('');
    const lrows = [-30, -10, 0, 10, 20, 30, 40, 50].map(l => { const p = C.wFromDbm(l); return `<tr><th>${esc(C.fmt(l, 3))} dBm</th><td>${esc(C.fmtW(p, 4))}</td><td>${esc(C.fmtV(C.uFromPower(p, 50), 4))}</td><td>${esc(C.fmt(C.dbmToDbuv50(l), 4))} dBµV</td></tr>`; }).join('');
    return `<div class="card pl"><h2 class="big">📘 Hilfe und Spickzettel</h2>
      <p>Alle sechs Blöcke haben eine Visualisierung zum Ausprobieren und Aufgaben mit Musterlösung. Bedienung: Regler ziehen oder mit den Pfeiltasten verstellen, Beispiele per Antippen laden.</p></div>
      <details class="more" open><summary>Dezibel: Faktoren zum Merken</summary><div class="mb tw"><table class="h"><thead><tr><th>Pegel­änderung</th><th>Leistung mal</th><th>Spannung mal</th><th>Leistung bei Minus</th><th>Spannung bei Minus</th></tr></thead><tbody>${rows}</tbody></table><p class="hint2">Die Zahlen stammen aus der Rechnung des Labs (hfcore.js). „Bei Minus“ heißt: derselbe Wert als Dämpfung.</p></div></details>
      <details class="more"><summary>Pegel in dBm: Leistung und Spannung an 50 Ω</summary><div class="mb tw"><table class="h"><thead><tr><th>Pegel</th><th>Leistung</th><th>Spannung an 50 Ω</th><th>Spannungs­pegel (gerundet + 107)</th></tr></thead><tbody>${lrows}</tbody></table></div></details>
      <details class="more"><summary>Formeln im Überblick</summary><div class="mb"><ul class="fl">
        <li>Pegel: a = 10 · lg(P₂/P₁) = 20 · lg(U₂/U₁); L = 10 · lg(P / 1 mW) in dBm; an 50 Ω: dBµV = dBm + 107</li>
        <li>Leitung: λ = c / f, im Kabel mal Verkürzungsfaktor; Z_W = √(L'/C'); r = (R − Z_W) / (R + Z_W); s = (1 + |r|) / (1 − |r|); Rückflussdämpfung = −20 · lg(|r|)</li>
        <li>Funkstrecke: a = 32,44 + 20 · lg(d in km) + 20 · lg(f in MHz); EIRP = P_S − a_Kabel + G; Reserve = Empfangspegel − Empfindlichkeit; dBi = dBd + 2,15</li>
        <li>Modulation: AM: B = 2 · f_m, m = (U_max − U_min) / (U_max + U_min); FM: η = Δf / f_m, B = 2 · (Δf + f_m); digital: Bitrate = Symbolrate · log₂(M), B = Symbolrate · (1 + α)</li>
        <li>Empfänger: Rauschboden = −174 dBm + 10 · lg(B in Hz) + F; Empfindlichkeit = Rauschboden + nötiger Abstand; Spiegelfrequenz = f_E ± 2 · f_ZF</li>
        <li>Messen: P = U² / R; û = √(2 · P · R); |r| = √(P_R / P_V); Q = f₀ / B; wahrer Pegel = Anzeige + externes Dämpfungsglied</li></ul></div></details>
      <details class="more"><summary>Hinweise zu den Aufgaben</summary><div class="mb"><p>Die Zahlen jeder Aufgabe werden zufällig gewürfelt („Neue Zahlen“). Die Musterlösung kommt aus der Rechnung des Labs, nicht aus einer festen Tabelle. Tipps haben drei Stufen: Denkanstoß, Formel, Formel mit Zahlen. Im Prüfmodus zählen Tipps 25 % Abzug je Stufe.</p><p>Eingabe: Dezimalkomma oder Punkt. Pegel in dB dürfen um 0,1 dB abweichen, alle anderen Ergebnisse um 1 %. Eine Dämpfung gibst du nur dann negativ an, wenn die Aufgabe das verlangt.</p><p>Feste Annahmen in allen Aufgaben: c = 300.000 km/s, Rauschen −174 dBm je Hz, Halbwellendipol 2,15 dBi, an 50 Ω liegen dBµV und dBm um 107 dB auseinander.</p></div></details>`;
  }
  const UIX = { defaults, TAB, TABS, LABTABS, labHTML, taskHTML, tipHTML, solutionHTML, taskListHTML, helpHTML, readout, fv, fromLg };
  root.HF_UIX = UIX;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIX;
  if (!hasDoc || !$('#mid')) return;

  /* ============================================================ DOM: Rahmen */
  const fx = () => root.LochFX || null;
  const ding = () => { const F = fx(); if (F && F.sound) try { F.sound('ding', 0.6); } catch (e) {} };
  const sad = () => { const F = fx(); if (F && F.sound) try { F.sound('sad', 0.5); } catch (e) {} };
  function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), Math.max(2200, m.length * 55)); }
  function sheet(title, build) {
    const prev = document.activeElement, bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh-h"><b>${esc(title)}</b><button type="button" class="x" aria-label="Schließen">✕</button></div><div class="sh-b"></div></div>`;
    document.body.appendChild(bd);
    const close = () => { bd.remove(); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
    $('.x', bd).onclick = close; build($('.sh-b', bd), close); try { $('.x', bd).focus(); } catch (e) {}
    return close;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const b = $$('.backdrop'); if (b.length) b[b.length - 1].remove(); } });

  /* ============================================================ DOM: Lab-Reiter */
  const labView = $('#labView');
  const CVH = { plan: w => Math.max(260, Math.min(360, w * 0.62)), wave: w => Math.max(240, Math.min(320, w * 0.55)), lev: w => Math.max(250, Math.min(340, w * 0.6)), res: w => Math.max(240, Math.min(330, w * 0.58)), fac: w => Math.max(240, Math.min(330, w * 0.58)), spec: w => Math.max(200, Math.min(260, w * 0.45)) };
  const cvH = (k, w) => Math.round((CVH[k] || (ww => Math.max(210, Math.min(300, ww * 0.52))))(w));
  let raf = 0;
  function saveLab() { lsSet('lab', S.lab); }
  function loadLab() {
    const st = lsGet('lab', null), d = defaults();
    if (st && typeof st === 'object') for (const k of Object.keys(d)) if (st[k] && typeof st[k] === 'object') { const mix = Object.assign({}, d[k], st[k]); let ok = false; try { ok = !!TAB[k].valid(mix); } catch (e) {} if (ok) d[k] = mix; }
    S.lab = d;
  }
  function renderLab(tab) {
    stopPlay();
    labView.innerHTML = labHTML(tab, S.lab);
    schedule();
  }
  function schedule() { if (raf) return; raf = (root.requestAnimationFrame || (f => setTimeout(f, 16)))(() => { raf = 0; update(); }); }
  function update() {
    if (!LABTABS.includes(S.tab)) return;
    const T = TAB[S.tab], s = S.lab[S.tab]; let m = null;
    try { m = T.model(s); } catch (e) { m = null; }
    const st = $('#status'), ro = $('#readout');
    if (!m) { if (ro) ro.innerHTML = ''; return; }
    for (const key of T.cv) {
      const cv = $('#cv_' + key); if (!cv || !m.plots[key]) continue;
      try { V.draw(cv, m.plots[key], cvH(key, cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 320)); } catch (e) {}
    }
    if (ro) ro.innerHTML = readout(m.metrics);
    if (st && T.status) { const r = T.status(m, s); st.hidden = false; st.className = 'status ' + r.cls; st.innerHTML = (r.icon ? `<span class="ic" aria-hidden="true">${r.icon}</span>` : '') + `<span>${esc(r.text)}</span>`; }
    const first = $('#cv_' + T.cv[0]); if (first && m.aria) first.setAttribute('aria-label', m.aria);
  }
  /* Reglerereignisse */
  labView.addEventListener('input', e => {
    const el = e.target, id = el.dataset && el.dataset.rg, s = S.lab[S.tab], T = TAB[S.tab];
    if (!id || !T || !T.ranges[id]) return;
    const disp = T.ranges[id](s, el.value); const o = $('#' + id + '_o'); if (o) o.textContent = disp;
    saveLab(); schedule();
  });
  labView.addEventListener('click', e => {
    const T = TAB[S.tab], s = S.lab[S.tab]; if (!T) return;
    const sg = e.target.closest('[data-seg] button');
    if (sg && T.segs) { const f = T.segs[sg.parentNode.dataset.seg]; if (f) { const rb = f(s, sg.dataset.k); saveLab(); if (rb) renderLab(S.tab); else { $$('button', sg.parentNode).forEach(b => { const on = b === sg; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); schedule(); } } return; }
    const ch = e.target.closest('[data-chip]');
    if (ch && T.chips) { if (T.chips(s, ch.dataset.chip)) { saveLab(); renderLab(S.tab); } return; }
    const ac = e.target.closest('[data-act]');
    if (ac) { const a = ac.dataset.act; if (a === 'goTasks') { S.filter = BLOCK(S.tab).cat; lsSet('filter', S.filter); setTab('tasks'); } else if (a === 'play' && S.tab === 'ltg') togglePlay(); }
  });
  /* Leitung: Welle laufen lassen (nicht bei reduzierter Bewegung) */
  function stopPlay() { if (S.play) { clearInterval(S.play); S.play = null; saveLab(); } const b = $('#ltPlay'); if (b) b.textContent = '▶ Welle laufen lassen'; }
  function togglePlay() {
    if (S.play) { stopPlay(); return; } if (reduced()) return;
    const b = $('#ltPlay'); if (b) b.textContent = '⏸ Anhalten';
    S.play = setInterval(() => {
      if (S.tab !== 'ltg' || document.hidden) { stopPlay(); return; }
      const s = S.lab.ltg; s.ph = Math.round(((s.ph + 0.02) % 1) * 100) / 100; if (s.ph > 0.98) s.ph = 0;
      const sl = $('#lPh'), o = $('#lPh_o'); if (sl) sl.value = s.ph; if (o) o.textContent = Math.round(s.ph * 100) + ' %';
      schedule();
    }, 60);
  }

  /* ============================================================ DOM: Aufgaben */
  const taskView = $('#taskView');
  function pctFor(id) { if (!exam()) return 100; const st = lsGet('ctipps', {})[id] || 0; return Math.max(0, 100 - 25 * st); }
  function markSolved(id, pc) { const p = lsGet('prog', {}); if ((p[id] || 0) < pc) p[id] = pc; lsSet('prog', p); if (pc > 0) { const d = done(); d[id] = true; lsSet('done', d); } updateBadge(); updatePal(); }
  function updateBadge() { const b = $('#tkBd'); if (b) b.textContent = nDone() + '/' + D.tasks.length; }
  function startTask(id, variant) {
    const t = D.tasks.find(x => x.id === id); if (!t) return;
    S.tv = S.tv || {}; S.tv[id] = variant || 0;
    S.t = { id, q: t.make(C.rng(id + '#' + S.tv[id]), C), ans: '', res: null, tip: 0 };
    const h = lsGet('hints', {}), c = lsGet('ctipps', {}); if (h[id]) { delete h[id]; lsSet('hints', h); } if (c[id]) { delete c[id]; lsSet('ctipps', c); }
    renderTasks();
    const inp = $('#tkIn'); if (inp) try { inp.scrollIntoView({ block: 'center' }); } catch (e) {}
  }
  function renderTasks(top) {
    const ctx = S.t, t = ctx && D.tasks.find(x => x.id === ctx.id); let h = '';
    if (t) {
      h += `<div class="card pl taskcard"><h3 class="gh2">Aufgabe · ${esc(t.cat)} <span class="lv" aria-label="Stufe ${t.level} von 3">${dots(t.level)}</span></h3><div class="big">${esc(t.title)}</div>${taskHTML(ctx)}`;
      if (exam()) h += '<p class="hint2 warn">🎓 Prüfmodus: Jede Tipp-Stufe kostet 25 % der Punkte.</p>';
      h += `<div class="btns"><button type="button" class="btn" data-a="neu">🎲 Neue Zahlen</button>${ctx.res && (ctx.res.ok || ctx.res.shown) ? '<button type="button" class="btn pri" data-a="next">Nächste Aufgabe</button>' : ''}<button type="button" class="btn" data-a="close">Schließen</button></div></div>`;
    }
    h += `<p class="hint2" style="margin:4px 0 8px">${nDone()} von ${D.tasks.length} Aufgaben gelöst. ${exam() ? '🎓 Prüfmodus ist an.' : 'Im Prüfmodus (🎓) zählen Tipps als Abzug.'}</p>`;
    h += taskListHTML(S.filter, done(), lsGet('prog', {}));
    const keep = $('#tkIn') && document.activeElement === $('#tkIn');
    taskView.innerHTML = h; if (top !== false) $('#pgTasks').scrollTop = 0; if (keep && $('#tkIn')) $('#tkIn').focus();
  }
  function checkTask() {
    const ctx = S.t; if (!ctx) return; const q = ctx.q, c = C.checkNum(ctx.ans, q.value, q.tol, q.unit);
    if (c.empty) { toast('Trage zuerst ein Ergebnis ein.'); return; }
    if (c.nan) { toast('Bitte gib eine Zahl ein (mit Komma oder Punkt).'); return; }
    ctx.res = { ok: c.ok, x: c.x }; if (!c.ok) ctx.tries = (ctx.tries || 0) + 1; const pc = c.ok ? pctFor(ctx.id) : 0;
    if (c.ok) { markSolved(ctx.id, pc); const F = fx(); if (F && F.pass) try { F.pass(pc); } catch (e) { ding(); } else ding(); toast(exam() && pc < 100 ? pc + ' % (Tipps abgezogen)' : '🎉 Geschafft!'); }
    else { sad(); toast('Noch nicht richtig. Lies den Tipp und versuche es noch einmal.'); }
    renderTasks(false);
    const fbEl = $('#tkFb'); if (fbEl && root.LabRahmen && root.LabRahmen.zeig) try { root.LabRahmen.zeig(fbEl); } catch (e) {}
  }
  function hintTask() {
    const ctx = S.t; if (!ctx) return; const id = ctx.id, h = lsGet('hints', {}), n = Math.min(3, (h[id] || 0) + 1);
    h[id] = n; lsSet('hints', h); ctx.tip = n;
    if (exam()) { const c = lsGet('ctipps', {}); c[id] = Math.max(c[id] || 0, n); lsSet('ctipps', c); }
    sheet('Tipp, Stufe ' + n + ' von 3', b => { b.innerHTML = tipHTML(ctx.q, n); });
  }
  taskView.addEventListener('input', e => { if (e.target.matches('[data-v]') && S.t) S.t.ans = e.target.value; });
  taskView.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-v]')) { e.preventDefault(); if (S.t && !(S.t.res && (S.t.res.ok || S.t.res.shown))) checkTask(); } });
  taskView.addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f) { S.filter = f.dataset.f; lsSet('filter', S.filter); renderTasks(false); return; }
    const row = e.target.closest('.row[data-t]'); if (row) { startTask(row.dataset.t); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'chk') checkTask(); else if (a === 'hint') hintTask();
    else if (a === 'show') { if (S.t) { S.t.res = { ok: false, shown: true, x: NaN }; renderTasks(false); } }
    else if (a === 'neu') { if (S.t) startTask(S.t.id, ((S.tv || {})[S.t.id] || 0) + 1); }
    else if (a === 'close') { S.t = null; renderTasks(); }
    else if (a === 'next') { if (!S.t) return; const list = D.tasks.filter(x => !S.filter || x.cat === S.filter), i = list.findIndex(x => x.id === S.t.id), nx = list.slice(i + 1).find(x => !done()[x.id]) || list[(i + 1) % list.length]; if (nx) startTask(nx.id); }
  });

  /* ============================================================ DOM: Reiter, Kopfzeile, Leiste */
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button type="button" class="tab${S.tab === k ? ' on' : ''}" data-t="${k}" role="tab" aria-selected="${S.tab === k}">${i} ${n}${k === 'tasks' ? '<span class="bd" id="tkBd"></span>' : ''}</button>`).join('');
    updateBadge();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  function setTab(t) {
    if (!TABS.some(x => x[0] === t)) t = 'peg'; stopPlay(); S.tab = t; lsSet('tab', t); $('#mid').dataset.tab = t;
    $$('.tab').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) { try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} } });
    if (LABTABS.includes(t)) renderLab(t); else if (t === 'tasks') renderTasks(); else $('#helpView').innerHTML = helpHTML();
    const T = TABS.find(x => x[0] === t); $('#title').innerHTML = esc(NAME) + '<small>' + esc(T[2]) + '</small>'; document.title = NAME + ': ' + T[2];
    const sc = $(LABTABS.includes(t) ? '#pgLab' : t === 'tasks' ? '#pgTasks' : '#pgHelp'); if (sc) sc.scrollTop = 0;
  }
  function setExam(on) { lsSet('exam', on ? '1' : '0'); updatePal(); $('#bExam').classList.toggle('on', on); $('#bExam').setAttribute('aria-pressed', on); toast(on ? '🎓 Prüfmodus an: Tipps kosten 25 % je Stufe.' : 'Prüfmodus aus: Tipps kosten nichts.'); if (S.tab === 'tasks') renderTasks(false); }
  let palSig = '';
  function updatePal() {
    const F = !!fx(), fxOn = F && !fx().isMuted(), sig = [F, fxOn, exam(), nDone()].join('|'); if (sig === palSig) return; palSig = sig;
    $('#pal').innerHTML = `${F ? `<button type="button" class="chip ${fxOn ? 'on' : ''}" data-a="fx" aria-pressed="${fxOn}" title="Effekte und Ton">${fxOn ? '🎉' : '🔇'} Effekte</button>` : ''}<button type="button" class="chip ${exam() ? 'on' : ''}" data-a="exam" aria-pressed="${exam()}" title="Prüfmodus: Tipps zählen als Abzug">🎓 Prüfmodus</button><button type="button" class="chip" data-a="rand" title="Zufällige offene Aufgabe">🎲 Zufallsaufgabe</button><span id="stat">Aufgaben gelöst <b>${nDone()}/${D.tasks.length}</b></span>`;
    $('#bExam').classList.toggle('on', exam()); $('#bExam').setAttribute('aria-pressed', exam());
  }
  $('#pal').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fx') { const F = fx(); if (F) { F.setMuted(!F.isMuted()); palSig = ''; updatePal(); if (!F.isMuted()) ding(); } }
    else if (b.dataset.a === 'exam') setExam(!exam());
    else if (b.dataset.a === 'rand') { const open = D.tasks.filter(t => !done()[t.id]), pool = open.length ? open : D.tasks, t = pool[Math.floor(Math.random() * pool.length)]; S.filter = ''; setTab('tasks'); startTask(t.id, Math.floor(Math.random() * 1000)); }
  });
  $('#bTasks').onclick = () => setTab('tasks'); $('#bHelp').onclick = () => setTab('help'); $('#bExam').onclick = () => setExam(!exam());
  $('#title').onclick = () => setTab('peg');
  $('#bMenu').onclick = () => {
    const rows = TABS.map(([k, i, n]) => [k, i + ' ' + n, k === 'tasks' ? D.tasks.length + ' Aufgaben mit Tipps und Musterlösung' : k === 'help' ? 'Spickzettel und Hinweise' : BLOCK(k).title]).concat([['exam', 'Prüfmodus: ' + (exam() ? 'an' : 'aus'), 'Im Prüfmodus kosten Tipps 25 % je Stufe'], ['reset', 'Fortschritt zurücksetzen', 'Löscht gelöste Aufgaben auf diesem Gerät'], ['home', 'Startseite', 'Zurück zur Übersicht']]);
    sheet('Menü', (b, close) => {
      b.innerHTML = rows.map(r => `<button type="button" class="row" data-m="${esc(r[0])}"><span class="grow"><b>${esc(r[1])}</b><small>${esc(r[2])}</small></span></button>`).join('');
      b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); const m = r.dataset.m; if (m === 'home') location.href = 'index.html'; else if (m === 'exam') setExam(!exam()); else if (m === 'reset') resetAll(); else setTab(m); });
    });
  };
  function resetAll() {
    sheet('Fortschritt zurücksetzen?', (b, close) => {
      b.innerHTML = '<p style="margin-top:0">Alle gelösten Aufgaben und Tipps dieses Labs werden auf diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.</p><div class="btns"><button type="button" class="btn" data-x="no">Abbrechen</button><button type="button" class="btn danger" data-x="yes">Löschen</button></div>';
      b.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'yes') { ['done', 'prog', 'hints', 'ctipps'].forEach(k => { try { localStorage.removeItem(LS + k); } catch (er) {} }); S.t = null; palSig = ''; updatePal(); updateBadge(); if (S.tab === 'tasks') renderTasks(); toast('Fortschritt gelöscht'); } close(); });
    });
  }

  /* Neuzeichnen bei Größen- und Themenwechsel */
  root.addEventListener('resize', schedule);
  try { if (root.ResizeObserver) new root.ResizeObserver(schedule).observe(labView); } catch (e) {}
  try { const mq = root.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', schedule) : mq.addListener && mq.addListener(schedule)); } catch (e) {}
  try { new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

  /* Schnittstelle für Karriere/Lernpfad */
  root.HF_LAB = { id: 'hf', title: NAME, stufe: D.meta.stufe, doneKey: LS + 'done', progKey: LS + 'prog', total: D.tasks.length, done: () => Object.keys(done()).filter(k => D.tasks.some(t => t.id === k)), tasks: root.HF_TASKS };
  root.LabGoto = id => { try { if (D.tasks.some(t => t.id === id)) { setTab('tasks'); startTask(id); return true; } } catch (e) {} return false; };

  loadLab(); S.filter = lsGet('filter', '') || ''; if (S.filter && !D.CATS.includes(S.filter)) S.filter = '';
  const st0 = lsGet('tab', 'peg'); S.tab = TABS.some(x => x[0] === st0) ? st0 : 'peg';
  buildTabs(); updatePal(); setTab(S.tab);
  try {
    const qs = new URLSearchParams(location.search), qa = qs.get('aufgabe'), qt = qs.get('tab');
    if (qa && D.tasks.some(t => t.id === qa)) { setTab('tasks'); startTask(qa); } else if (qt && TABS.some(x => x[0] === qt)) setTab(qt);
  } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
