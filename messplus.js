'use strict';
/* Tonfunk MessLab: zusätzliche Geräte der Werkbank.
   Frequenzgang (Bode-Messplatz), Logikanalysator, Messprotokoll zum Ausdrucken und die Genauigkeitsangabe des Multimeters.
   Wird von mess.js mit MESS_PLUS(api, H) eingehängt (H: INST, ORDER und Hilfsfunktionen der Werkbank). */
(function (root) {
  /* ---------- Multimeter: Genauigkeit ---------- */
  const ACC = { 'V=': [0.5, 3, 'Gleichspannung'], 'V~': [1.0, 5, 'Wechselspannung'], 'A': [1.0, 3, 'Strom'], 'R': [0.8, 3, 'Widerstand'] };
  const rd = txt => { const m = String(txt || '').trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([pnuµmkMG]?)\s*([VAΩ])/); if (!m) return null; const dec = (m[1].split(/[.,]/)[1] || '').length; return { val: parseFloat(m[1].replace(',', '.')), dec, pre: m[2], unit: m[3] }; };
  /* Unsicherheit in der Anzeige-Einheit: Prozent vom Messwert plus Digits (Schritte der letzten Stelle) */
  function dmmUnc(val, dec, dial) { const a = ACC[dial] || ACC['V=']; return Math.abs(val) * a[0] / 100 + a[1] * Math.pow(10, -dec); }
  function dmmAcc(txt, dial) {
    const r = rd(txt), a = ACC[dial]; if (!r || !a) return '';
    const u = dmmUnc(r.val, r.dec, dial), f = x => x.toFixed(Math.max(r.dec, 0)).replace('.', ',') , uf = (u < 1 ? u.toFixed(Math.min(r.dec + 1, 4)) : u.toFixed(2)).replace('.', ',');
    return 'Genauigkeit ± (' + String(a[0]).replace('.', ',') + ' % + ' + a[1] + ' Digit) → ± ' + uf + ' ' + r.pre + r.unit + ': der wahre Wert liegt zwischen ' + f(r.val - u) + ' und ' + f(r.val + u) + ' ' + r.pre + r.unit;
  }
  root.MESS_PLUS_ACC = { dmmAcc, dmmUnc, rd, ACC };

  root.MESS_PLUS = function (api, H) {
    const { INST, ORDER, partsOf, partSel, mark, S, esc, num, LANECOL, fmtHz, parseHz, OSC, TDIV, parseVal } = H;
    const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };
    const lg = x => Math.log(x) / Math.LN10;

    /* =============== Frequenzgang (Bode) =============== */
    const BODE = { name: 'Frequenzgang', icon: '〽️', w: 470, g: 0, o: 0, inv: false, curve: null, f1: 10, f2: 100000, mark: null };
    function bodeSweep(gid, oid, f1, f2, n, inv, refine) {
      const S0 = S(), tmp = { name: 'tmp', parts: JSON.parse(JSON.stringify(S0.parts)), wires: JSON.parse(JSON.stringify(S0.wires)), nid: S0.nid, scopes: [] }, pts = [];
      const amp = 1;
      api.withSch(tmp, () => {
        const g = tmp.parts.find(p => p.id === gid), o = tmp.parts.find(p => p.id === oid); if (!g || !o) return; g.vr = 'sin';
        const point = f => {
          g.v = amp + 'V ' + fmtHz(f);
          const E = api.simEval(), T = 1 / f, per = 160, dt = T / per, SET = 12, MEA = 3;
          for (let i = 0; i < SET * per; i++) E.s.step(dt);
          let ci = 0, si = 0, co = 0, so = 0; const w = 2 * Math.PI * f, N = MEA * per;
          for (let j = 0; j < N; j++) { E.s.step(dt); const t = (j + 1) * dt, vi = api.vAcross(E, g), vo = api.vAcross(E, o) * (inv ? -1 : 1); ci += vi * Math.cos(w * t); si += vi * Math.sin(w * t); co += vo * Math.cos(w * t); so += vo * Math.sin(w * t); }
          ci *= 2 / N; si *= 2 / N; co *= 2 / N; so *= 2 / N;
          const Ai = Math.hypot(ci, si), Ao = Math.hypot(co, so); let ph = (Math.atan2(co, so) - Math.atan2(ci, si)) * 180 / Math.PI; while (ph > 180) ph -= 360; while (ph <= -180) ph += 360;
          return Ai > 1e-9 ? { f, db: 20 * lg(Math.max(Ao / Ai, 1e-6)), ph } : null;
        };
        for (let k = 0; k < n; k++) { const f = f1 * Math.pow(f2 / f1, n > 1 ? k / (n - 1) : 0); try { const p = point(f); if (p) pts.push(p); } catch (e) { /* Punkt auslassen */ } }
        if (refine && pts.length > 3) {                                // Grenzfrequenz genauer: Intervall um den −3-dB-Punkt halbieren
          const mx = Math.max(...pts.map(p => p.db)), tgt = mx - 3.0103;
          for (let i = 1; i < pts.length; i++) { let a = pts[i - 1], b = pts[i]; if ((a.db - tgt) * (b.db - tgt) <= 0 && a.db !== b.db) { for (let it = 0; it < 6; it++) { const m = point(Math.sqrt(a.f * b.f)); if (!m) break; if ((a.db - tgt) * (m.db - tgt) <= 0) b = m; else a = m; pts.push(m); } break; } }
          pts.sort((p, q) => p.f - q.f);
        }
      });
      return pts;
    }
    function bodeFg(pts) {
      if (pts.length < 3) return null; const mx = Math.max(...pts.map(p => p.db)), tgt = mx - 3.0103; let best = null;
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((a.db - tgt) * (b.db - tgt) <= 0 && a.db !== b.db) { const t = (tgt - a.db) / (b.db - a.db), f = Math.pow(10, lg(a.f) + t * (lg(b.f) - lg(a.f))); if (!best || Math.abs(a.db - mx) < Math.abs(best.near - mx)) best = { f, near: a.db }; } }
      return best ? best.f : null;
    }
    root.MESS_PLUS_BODE = { sweep: bodeSweep, fg: bodeFg };
    BODE.build = el => {
      el.innerHTML = '<div class="wbmut" style="margin-bottom:4px">Der Messplatz stellt den Generator Schritt für Schritt höher und misst, wie stark das Signal am Ausgang ankommt (Verstärkung in dB) und wie weit es zeitlich hinterherhinkt (Phase).</div><div class="wbrow"><label class="wbf" style="flex:1">Eingang (Generator)<span data-g></span></label><label class="wbf" style="flex:1">Ausgang (Spannung an Bauteil)<span data-o></span></label></div><div class="wbrow"><label class="wbf" style="flex:1">von<input type="text" data-f1 value="10 Hz"></label><label class="wbf" style="flex:1">bis<input type="text" data-f2 value="100 kHz"></label><label class="wbf" style="flex:none;align-self:end"><span><input type="checkbox" data-inv style="width:auto"> Ausgang umpolen</span></label></div><div class="wbrow"><button class="wbb on" data-go>Frequenzgang aufnehmen</button><span class="wbmut" data-st></span></div><canvas data-cv width="470" height="320" style="width:100%;border-radius:8px;background:#0b1a10;touch-action:none;display:block"></canvas><div class="wbmeas" data-meas>Nach der Messung: In die Kurve tippen, dann siehst du Frequenz, Verstärkung und Phase.</div>';
      const q = s => el.querySelector(s), cvs = q('[data-cv]'), g = cvs.getContext('2d'), W = 470, Ht = 320, t = {};
      const gens = () => partsOf(['AC']), outs = () => S().parts.filter(p => !['GND', 'AC', 'BAT'].includes(p.k));
      const fill = () => {
        const G = gens(), O = outs(); if (!G.some(p => p.id === BODE.g)) BODE.g = G[0] ? G[0].id : 0; if (!O.some(p => p.id === BODE.o)) { const c = O.find(p => p.k === 'C') || O[O.length - 1]; BODE.o = c ? c.id : 0; }
        q('[data-g]').innerHTML = G.length ? partSel(G, BODE.g) : '<div class="wbmut">Zeichne eine „Wechselspannung“ als Generator.</div>';
        q('[data-o]').innerHTML = O.length ? partSel(O, BODE.o) : '<div class="wbmut">Keine Bauteile.</div>';
        const sg = q('[data-g] select'), so = q('[data-o] select'); if (sg) sg.onchange = () => { BODE.g = +sg.value; }; if (so) so.onchange = () => { BODE.o = +so.value; BODE.curve = null; };
      };
      const X = (f, f1, f2) => 40 + (lg(f) - lg(f1)) / (lg(f2) - lg(f1)) * (W - 52);
      const plot = () => {
        g.fillStyle = '#0b1a10'; g.fillRect(0, 0, W, Ht); const c = BODE.curve; const f1 = c ? c.f1 : 10, f2 = c ? c.f2 : 1e5;
        g.strokeStyle = '#1f4a2a'; g.lineWidth = 1; g.fillStyle = '#9fe3b0'; g.font = '11px sans-serif'; g.textAlign = 'center';
        const dec0 = Math.ceil(lg(f1)), dec1 = Math.floor(lg(f2)); for (let d = dec0; d <= dec1; d++) { const x = X(Math.pow(10, d), f1, f2); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, Ht - 22); g.stroke(); g.fillText(fmtHz(Math.pow(10, d)), x, Ht - 8); }
        const top = [8, 160], bot = [176, Ht - 24];
        if (!c || !c.pts.length) { g.fillStyle = '#9fe3b0'; g.font = '13px sans-serif'; g.fillText('Noch keine Messung', W / 2, 150); return; }
        const dbs = c.pts.map(p => p.db), dmax = Math.ceil((Math.max(...dbs) + 1) / 10) * 10, dmin = Math.min(dmax - 20, Math.floor(Math.min(...dbs) / 10) * 10, -10), Yd = db => top[0] + (dmax - db) / (dmax - dmin) * (top[1] - top[0]), Yp = ph => bot[0] + (180 - ph) / 360 * (bot[1] - bot[0]);
        for (let db = dmin; db <= dmax; db += 10) { const y = Yd(db); g.strokeStyle = db === 0 ? '#2c6b3b' : '#1f4a2a'; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 12, y); g.stroke(); g.fillStyle = '#9fe3b0'; g.textAlign = 'right'; g.fillText(db + ' dB', 36, y + 4); }
        [-180, -90, 0, 90, 180].forEach(ph => { const y = Yp(ph); g.strokeStyle = ph === 0 ? '#2c6b3b' : '#1f4a2a'; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 12, y); g.stroke(); g.fillStyle = '#9fe3b0'; g.textAlign = 'right'; g.fillText(ph + '°', 36, y + 4); });
        const mx = Math.max(...dbs); g.strokeStyle = '#ff9ad5'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(40, Yd(mx - 3.0103)); g.lineTo(W - 12, Yd(mx - 3.0103)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9ad5'; g.textAlign = 'left'; g.fillText('−3 dB', 44, Yd(mx - 3.0103) - 3);
        g.lineWidth = 2; g.strokeStyle = '#6dff7a'; g.beginPath(); c.pts.forEach((p, i) => { const x = X(p.f, f1, f2), y = Yd(p.db); if (!i) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke();
        g.strokeStyle = '#ffe14d'; g.beginPath(); c.pts.forEach((p, i) => { const x = X(p.f, f1, f2), y = Yp(p.ph); if (!i) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke();
        const fg = bodeFg(c.pts); if (fg) { const x = X(fg, f1, f2); g.strokeStyle = '#ff9ad5'; g.beginPath(); g.moveTo(x, 8); g.lineTo(x, Ht - 22); g.stroke(); g.fillStyle = '#ff9ad5'; g.textAlign = 'center'; g.fillText('fg ≈ ' + fmtHz(+fg.toPrecision(3)), Math.min(W - 50, Math.max(60, x)), 20); }
        if (t.mark) { const p = t.mark, x = X(p.f, f1, f2); g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, Yd(p.db), 5, 0, 7); g.stroke(); g.beginPath(); g.arc(x, Yp(p.ph), 5, 0, 7); g.stroke(); }
        g.textAlign = 'left'; g.fillStyle = '#6dff7a'; g.fillText('Verstärkung', 44, top[0] + 10); g.fillStyle = '#ffe14d'; g.fillText('Phase', 44, bot[0] + 10);
        t.X = p => X(p, f1, f2);
      };
      cvs.onpointerdown = e => { const c = BODE.curve; if (!c || !t.X) return; const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; let best = null, bd = 1e9; c.pts.forEach(p => { const d = Math.abs(t.X(p.f) - x); if (d < bd) { bd = d; best = p; } }); if (best) { t.mark = best; q('[data-meas]').innerHTML = `f = <b>${fmtHz(+best.f.toPrecision(3))}</b> · Verstärkung <b>${num(best.db, 1)} dB</b> (Faktor ${num(Math.pow(10, best.db / 20), 3)}) · Phase <b>${num(best.ph, 0)}°</b>`; plot(); } };
      q('[data-go]').onclick = () => {
        const f1 = parseHz(q('[data-f1]').value), f2 = parseHz(q('[data-f2]').value); if (!(f1 > 0) || !(f2 > f1 * 2)) { q('[data-st]').textContent = 'von und bis prüfen (bis > 2 · von)'; return; } if (!gens().length) { q('[data-st]').textContent = 'Es fehlt ein Generator'; return; }
        q('[data-st]').textContent = 'rechne …'; BODE.inv = q('[data-inv]').checked;
        setTimeout(() => { try { const pts = bodeSweep(BODE.g, BODE.o, f1, f2, 33, BODE.inv, true); BODE.curve = { pts, f1, f2 }; t.mark = null; const fg = bodeFg(pts); q('[data-st]').textContent = pts.length + ' Punkte' + (fg ? ' · Grenzfrequenz ' + fmtHz(+fg.toPrecision(3)) : ''); q('[data-meas]').innerHTML = fg ? `Die <b>Grenzfrequenz</b> liegt dort, wo die Verstärkung um 3 dB (Faktor 0,707) unter dem Maximum liegt: <b>${fmtHz(+fg.toPrecision(3))}</b>.` : 'Keine Grenzfrequenz im Bereich: Die Verstärkung fällt nirgends um 3 dB.'; mark('bode'); stat('bode', 1, 'max'); } catch (e) { q('[data-st]').textContent = 'Fehler: ' + e.message; } plot(); }, 20);
      };
      fill(); t.n = S().parts.length; plot();
      return { update() { if (S().parts.length !== t.n) { t.n = S().parts.length; fill(); } } };
    };

    /* =============== Logikanalysator =============== */
    const LA = { name: 'Logikanalysator', icon: '🧮', w: 560, th: 0, bus: true, cur: null };
    LA.build = el => {
      el.innerHTML = '<canvas data-cv width="560" height="220" style="width:100%;border-radius:8px;background:#0b1a10;touch-action:none;display:block"></canvas><div class="wbrow"><span class="wbtag">Zeit</span><button class="wbb" data-tm>−</button><b class="wbv" data-tv></b><button class="wbb" data-tp>＋</button><span class="wbtag">Schwelle</span><button class="wbb" data-hm>−</button><b class="wbv" data-hv></b><button class="wbb" data-hp>＋</button></div><div class="wbmeas" data-meas>Der Logikanalysator zeigt die Messpunkte des Oszilloskops als digitale Kanäle: oberhalb der Schwelle ist ein Kanal 1 (High), darunter 0 (Low). K1 ist das niedrigste Bit der Zahl am Bus. Setze Messpunkte am Oszilloskop („Messpunkt setzen“).</div>';
      const q = s => el.querySelector(s), cvs = q('[data-cv]'), g = cvs.getContext('2d'), W = 560, Ht = 220;
      const win = () => 10 * TDIV[OSC.ti];
      const sync = () => { q('[data-tv]').textContent = (TDIV[OSC.ti] >= 1e-3 ? (TDIV[OSC.ti] * 1e3) + ' ms' : (TDIV[OSC.ti] * 1e6) + ' µs') + '/Teil'; q('[data-hv]').textContent = num(LA.th, 2) + ' V'; };
      q('[data-tm]').onclick = () => { OSC.ti = Math.max(0, OSC.ti - 1); api.setGraphWin(win()); sync(); }; q('[data-tp]').onclick = () => { OSC.ti = Math.min(TDIV.length - 1, OSC.ti + 1); api.setGraphWin(win()); sync(); };
      q('[data-hm]').onclick = () => { LA.th -= 0.5; sync(); }; q('[data-hp]').onclick = () => { LA.th += 0.5; sync(); };
      const buf = k => { const b = api.scopeBuf && api.scopeBuf[k]; return b && b.t.length > 1 ? b : null; };
      const lvl = (b, tt) => { let lo = 0, hi = b.t.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b.t[m] <= tt) lo = m; else hi = m - 1; } return b.v[lo] > LA.th ? 1 : 0; };
      const render = () => {
        g.fillStyle = '#0b1a10'; g.fillRect(0, 0, W, Ht); const n = Math.min((S().scopes || []).length, 4); if (!n) { g.fillStyle = '#9fe3b0'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Keine Kanäle. Setze Messpunkte am Oszilloskop.', W / 2, Ht / 2); return; }
        const b0 = buf(0); if (!b0) return; const tEnd = b0.t[b0.t.length - 1], w = win(), t0 = tEnd - w, lane = (Ht - 46) / n;
        g.strokeStyle = '#1f4a2a'; g.lineWidth = 1; for (let i = 0; i <= 10; i++) { const x = 44 + i * (W - 52) / 10; g.beginPath(); g.moveTo(x, 4); g.lineTo(x, Ht - 40); g.stroke(); }
        for (let k = 0; k < n; k++) {
          const b = buf(k); if (!b) continue; const y0 = 8 + k * lane + lane - 10, y1 = 8 + k * lane + 10; g.strokeStyle = LANECOL[k]; g.lineWidth = 2; g.beginPath(); let prev = null;
          for (let px = 0; px <= W - 52; px += 1) { const tt = t0 + px / (W - 52) * w, v = lvl(b, tt), x = 44 + px, y = v ? y1 : y0; if (prev == null) g.moveTo(x, y); else { if (v !== prev) g.lineTo(x, prev ? y1 : y0); g.lineTo(x, y); } prev = v; }
          g.stroke(); g.fillStyle = LANECOL[k]; g.font = '700 12px sans-serif'; g.textAlign = 'left'; g.fillText('K' + (k + 1), 4, (y0 + y1) / 2 + 4);
        }
        // Bus als Zahl: ein Wert je Abschnitt
        const code = tt => { let v = 0; for (let k = 0; k < n; k++) { const b = buf(k); if (b && lvl(b, tt)) v |= 1 << k; } return v; };
        g.fillStyle = '#9fe3b0'; g.font = '700 12px monospace'; g.textAlign = 'center'; let last = -1, xs = 44;
        for (let px = 0; px <= W - 52; px += 1) { const v = code(t0 + px / (W - 52) * w); if (v !== last) { if (last >= 0 && px - xs > 18) g.fillText(String(last), (xs + 44 + px) / 2 - 22 + 22, Ht - 24); last = v; xs = px; } }
        if (last >= 0 && W - 52 - xs > 18) g.fillText(String(last), (xs + 44 + W - 52) / 2 - 0, Ht - 24);
        g.fillStyle = '#9fe3b0'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('Bus (Dezimalzahl, K1 = niedrigstes Bit)', 44, Ht - 8);
        if (LA.cur != null) { const x = 44 + LA.cur * (W - 52); g.strokeStyle = '#7ad7ff'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Ht - 30); g.stroke(); g.setLineDash([]); const v = code(t0 + LA.cur * w); q('[data-meas]').innerHTML = `Cursor bei ${api.fmt(LA.cur * w, 's')}: ` + Array.from({ length: n }, (_, k) => `<b style="color:${LANECOL[k]}">K${k + 1}=${(v >> k) & 1}</b>`).join(' ') + ` · Zahl <b>${v}</b> (binär ${v.toString(2).padStart(n, '0')}, hex ${v.toString(16).toUpperCase()})`; }
      };
      cvs.onpointerdown = e => { const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; LA.cur = Math.max(0, Math.min(1, (x - 44) / (W - 52))); mark('la'); stat('la', 1, 'max'); };
      sync(); return { update() { sync(); render(); } };
    };

    /* =============== Messprotokoll =============== */
    const PROT = { name: 'Messprotokoll', icon: '📋', w: 520 };
    const LSK = 'mess.prot';
    const loadP = () => { try { return JSON.parse(localStorage.getItem(LSK) || 'null') || { head: { name: '', task: '' }, rows: [] }; } catch (e) { return { head: { name: '', task: '' }, rows: [] }; } };
    const saveP = p => { try { localStorage.setItem(LSK, JSON.stringify(p)); } catch (e) {} };
    function devPct(soll, ist) { const a = parseVal(soll, ''), b = parseVal(ist, ''); if (!isFinite(a) || !isFinite(b) || a === 0) return null; return (b - a) / a * 100; }
    function protHtml(p, forPrint) {
      const d = new Date(), date = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const nm = p.head.name || (root.Lernpfad && '') || '', task = p.head.task || (S().name || '');
      let h = `<div style="font-family:system-ui,sans-serif;color:#111"><h2 style="margin:0 0 4px">Messprotokoll</h2><div style="font-size:13px;margin-bottom:8px">Name: <b>${esc(nm)}</b> · Aufgabe / Schaltung: <b>${esc(task)}</b> · Datum: ${esc(date)}</div><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#eee">${['Nr.', 'Messgröße / Messpunkt', 'Sollwert', 'Istwert', 'Abweichung', 'Bemerkung'].map(x => `<th style="border:1px solid #999;padding:4px 6px;text-align:left">${x}</th>`).join('')}</tr>`;
      p.rows.forEach((r, i) => { const dv = devPct(r.soll, r.ist); h += `<tr><td style="border:1px solid #999;padding:4px 6px">${i + 1}</td><td style="border:1px solid #999;padding:4px 6px">${esc(r.what)}</td><td style="border:1px solid #999;padding:4px 6px">${esc(r.soll)}</td><td style="border:1px solid #999;padding:4px 6px">${esc(r.ist)}</td><td style="border:1px solid #999;padding:4px 6px">${dv == null ? '' : num(dv, 1) + ' %'}</td><td style="border:1px solid #999;padding:4px 6px">${esc(r.note || '')}</td></tr>`; });
      if (!p.rows.length) h += '<tr><td colspan="6" style="border:1px solid #999;padding:8px;color:#777">Noch keine Messungen.</td></tr>';
      return h + `</table><div style="margin-top:28px;font-size:12px;color:#555">Unterschrift: ______________________</div></div>`;
    }
    PROT.build = el => {
      el.innerHTML = '<div class="wbrow"><label class="wbf" style="flex:1">Name<input type="text" data-nm></label><label class="wbf" style="flex:1">Aufgabe / Schaltung<input type="text" data-tk></label></div><div class="wbrow"><button class="wbb" data-dmm>Multimeter übernehmen</button><button class="wbb" data-osc>Oszilloskop übernehmen</button><button class="wbb" data-add>＋ Zeile</button></div><div data-tbl style="overflow:auto;max-height:260px"></div><div class="wbrow"><button class="wbb on" data-pr>🖨 Drucken</button><button class="wbb" data-clr>Alles löschen</button></div><div class="wbmut" data-st></div>';
      const q = s => el.querySelector(s); let P = loadP();
      const draw = () => {
        q('[data-nm]').value = P.head.name || ''; q('[data-tk]').value = P.head.task || '';
        q('[data-tbl]').innerHTML = '<table style="border-collapse:collapse;width:100%;font-size:12px"><tr style="color:var(--mute);text-align:left"><th>Messgröße</th><th>Soll</th><th>Ist</th><th>Abw.</th><th></th></tr>' + P.rows.map((r, i) => { const dv = devPct(r.soll, r.ist); return `<tr style="border-top:1px solid var(--line)"><td><input data-w="${i}" value="${esc(r.what)}" style="width:150px"></td><td><input data-s="${i}" value="${esc(r.soll)}" style="width:64px"></td><td><input data-i="${i}" value="${esc(r.ist)}" style="width:80px"></td><td>${dv == null ? '' : num(dv, 1) + ' %'}</td><td><button class="wbb" data-d="${i}" style="height:24px">✕</button></td></tr>`; }).join('') + '</table>' + (P.rows.length ? '' : '<div class="wbmut">Noch keine Messung im Protokoll. Übernimm Werte von den Geräten oder füge Zeilen von Hand hinzu.</div>');
        q('[data-tbl]').querySelectorAll('input').forEach(x => { x.onchange = () => { const r = P.rows[+(x.dataset.w || x.dataset.s || x.dataset.i)]; if (x.dataset.w != null) r.what = x.value; if (x.dataset.s != null) r.soll = x.value; if (x.dataset.i != null) r.ist = x.value; saveP(P); draw(); }; });
        q('[data-tbl]').querySelectorAll('[data-d]').forEach(x => { x.onclick = () => { P.rows.splice(+x.dataset.d, 1); saveP(P); draw(); }; });
      };
      q('[data-nm]').onchange = () => { P.head.name = q('[data-nm]').value; saveP(P); }; q('[data-tk]').onchange = () => { P.head.task = q('[data-tk]').value; saveP(P); };
      q('[data-add]').onclick = () => { P.rows.push({ what: '', soll: '', ist: '', note: '' }); saveP(P); draw(); };
      q('[data-dmm]').onclick = () => { let r = null; try { r = api.meterText(); } catch (e) {} if (!r || !r.main || r.main === '--') { q('[data-st]').textContent = 'Das Multimeter zeigt keinen Wert. Messspitzen setzen und messen.'; return; } const dial = api.meter ? api.meter.dial : ''; P.rows.push({ what: ({ 'V=': 'Gleichspannung', 'V~': 'Wechselspannung', A: 'Strom', R: 'Widerstand' }[dial] || 'Messung') + ': ' + (r.sub || ''), soll: '', ist: r.main.replace(',', ','), note: root.MESS_PLUS_ACC.dmmAcc(r.main, dial).replace(/^Genauigkeit /, 'Genauigkeit ') }); saveP(P); draw(); q('[data-st]').textContent = 'Übernommen.'; mark('prot'); };
      q('[data-osc]').onclick = () => { const k = Math.min(OSC.cur, Math.max(0, (S().scopes || []).length - 1)); if (!(S().scopes || []).length || !OSC.measure) { q('[data-st]').textContent = 'Setze zuerst am Oszilloskop einen Messpunkt.'; return; } const n = TDIV[OSC.ti] * 10, d = OSC.series(k); if (!d) { q('[data-st]').textContent = 'Noch keine Messwerte (Simulation starten).'; return; } const t1 = d.t[d.t.length - 1], m = OSC.measure(k, t1 - n, n); if (!m) { q('[data-st]').textContent = 'Noch keine Messwerte.'; return; } [['Uss', m.pp, 'V'], ['Ueff', m.rms, 'V'], ['Umittel', m.mean, 'V'], ['f', m.f, 'Hz']].forEach(([nm, v, u]) => { if (isFinite(v)) P.rows.push({ what: 'Oszilloskop K' + (k + 1) + ': ' + nm, soll: '', ist: api.fmt(v, u), note: '' }); }); saveP(P); draw(); q('[data-st]').textContent = 'Übernommen.'; mark('prot'); };
      q('[data-pr]').onclick = () => { const w = window.open('', '_blank'); if (!w) { q('[data-st]').textContent = 'Das Fenster wurde blockiert. Erlaube Pop-ups oder drucke die Seite.'; return; } w.document.write('<!doctype html><meta charset="utf-8"><title>Messprotokoll</title><body style="margin:20px">' + protHtml(P, true) + '<script>setTimeout(function(){window.print()},300)<\/script>'); w.document.close(); stat('protDruck', 1, 'max'); };
      q('[data-clr]').onclick = () => { if (!P.rows.length || confirm('Alle Zeilen im Messprotokoll löschen?')) { P = { head: P.head, rows: [] }; saveP(P); draw(); } };
      draw(); return { update() {} };
    };
    root.MESS_PLUS_PROT = { html: protHtml, load: loadP, save: saveP };

    INST.bode = BODE; INST.la = LA; INST.prot = PROT; ORDER.push('bode', 'la', 'prot');
  };
})(window);
