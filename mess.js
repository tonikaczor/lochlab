'use strict';
/* Tonfunk MessLab: die Werkbank mit Netzgerät, Funktionsgenerator, Multimeter, Oszilloskop, Frequenzzähler,
   Leistungsmesser und Kennlinienschreiber. Die Geräte gibt es in zwei Ansichten: fest (unten angedockt) und frei (verschiebbare Fenster).
   schaltplan.js ruft MESS_DEF(api) auf, bevor das Lab startet; die Beispiele und Aufgaben stehen in messdata.js. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (x, d) => (isFinite(x) ? x : 0).toFixed(d == null ? 3 : d).replace('.', ',');
  const LANECOL = ['#6dff7a', '#ffe14d', '#4cc3ff', '#ff8a5c'];
  const store = { get(k, d) { try { const v = localStorage.getItem('mess.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('mess.' + k, JSON.stringify(v)); } catch (e) {} } };
  const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };

  /* Zahl aus einer Eingabe lesen: "4,5", "250mA", "1,2 kΩ". Ohne Einheit gilt die Einheit, die neben dem Feld steht (unit). Ergebnis in Grundeinheiten. */
  const PRE = { p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  function parseVal(str, unit) {
    const s = String(str == null ? '' : str).trim().replace(',', '.').replace(/\s+/g, '');
    const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(.*)$/i); if (!m) return NaN;
    const x = parseFloat(m[1]), rest = m[2], base = /^(V|A|Ω|ohm|W|Wh|Hz|s|F|H|%)/i;
    const own = rest.length === 1 && PRE[rest] ? PRE[rest] : (rest.length > 1 && PRE[rest.charAt(0)] && base.test(rest.slice(1)) ? PRE[rest.charAt(0)] : (rest && base.test(rest) ? 1 : null));
    const u = String(unit || ''), def = u.length > 1 && PRE[u.charAt(0)] && base.test(u.slice(1)) ? PRE[u.charAt(0)] : 1;
    return x * (own == null ? def : own);
  }
  root.MessParse = parseVal;

  root.MESS_DEF = function (api) {
    const S = () => api.sch;
    let wb = store.get('wb', null) || { mode: 'dock', open: { psu: 1, gen: 1, dmm: 1, osc: 1 }, pos: {} };
    wb.open = wb.open || {}; wb.pos = wb.pos || {};
    const save = () => store.set('wb', wb);
    const used = {};
    const mark = id => { if (used[id]) return; used[id] = 1; stat('bench_' + id, 1, 'max'); };
    const apply = () => { api.commit(true, true); api.rebuildKeep(); api.refreshUI(); api.draw(); };
    const partsOf = ks => S().parts.filter(p => ks.includes(p.k));
    const nmOf = (p, i) => p.l || (api.KINDS[p.k].name + (i != null ? ' ' + (i + 1) : ''));
    const partSel = (list, cur, onSel) => list.length ? `<select class="wbsel" data-sel>${list.map((p, i) => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(nmOf(p, i))}</option>`).join('')}</select>` : '';
    const live = () => !!(api.sim && api.circ);
    const valOf = p => { try { return api.scopeValues({ t: 'part', id: p.id }); } catch (e) { return [NaN, NaN]; } };

    /* ---------------- Netzgerät ---------------- */
    const PSU = {
      name: 'Netzgerät', icon: '🔋', w: 270, sel: 0,
      build(el) {
        const t = { p: null };
        el.innerHTML = '<div class="wbc"></div><div class="wbrow"><div class="wbd"><small>Spannung</small><b data-u>--</b></div><div class="wbd"><small>Strom</small><b data-i>--</b></div></div><div class="wbrow"><span class="wblamp" data-cv>CV</span><span class="wblamp" data-cc>CC</span><span class="wbmut" data-modetxt></span></div>'
          + '<label class="wbf">Spannung einstellen <b data-uv></b><input type="range" min="0" max="30" step="0.1" data-us></label><label class="wbf"><span><input type="checkbox" data-lim style="width:auto"> Strombegrenzung</span> <b data-iv></b><input type="range" min="10" max="2000" step="10" data-is></label><div class="wbmut" data-note></div>';
        const q = s => el.querySelector(s);
        const cur = () => S().parts.find(p => p.id === PSU.sel && p.k === 'BAT') || partsOf(['BAT'])[0] || null;
        const fill = () => { const p = cur(); t.p = p; q('.wbc').innerHTML = p ? partSel(partsOf(['BAT']), p.id) : '<div class="wbmut">Keine Spannungsquelle in der Schaltung. Zeichne eine „Gleichspannung“.</div>'; const sl = q('.wbc select'); if (sl) sl.onchange = () => { PSU.sel = +sl.value; fill(); sync(); }; };
        const sync = () => { const p = cur(); if (!p) return; const u = parseFloat(String(p.v).replace(',', '.')) || 0, im = api.nm ? 0 : 0; q('[data-us]').value = u; q('[data-uv]').textContent = num(u, 1) + ' V'; const lim = String(p.imax || '').trim(); q('[data-lim]').checked = !!lim; let mA = 0; if (lim) { const m = lim.replace(',', '.').match(/([0-9.]+)\s*(m?)A?/i); if (m) mA = parseFloat(m[1]) * (m[2] ? 1 : 1000); } if (mA) q('[data-is]').value = Math.min(2000, mA); q('[data-iv]').textContent = lim ? lim : 'aus'; };
        const write = () => { const p = cur(); if (!p) return; const u = Math.round(parseFloat(q('[data-us]').value) * 10) / 10; p.v = String(u); p.vr = 'psu'; const mA = parseFloat(q('[data-is]').value); p.imax = q('[data-lim]').checked ? (mA >= 1000 ? (mA / 1000) + 'A' : mA + 'mA') : ''; q('[data-uv]').textContent = num(u, 1) + ' V'; q('[data-iv]').textContent = p.imax || 'aus'; mark('psu'); apply(); };
        ['[data-us]', '[data-is]'].forEach(s => { q(s).oninput = write; }); q('[data-lim]').onchange = write;
        fill(); sync(); t.key = '';
        return {
          update() {
            const p = cur(); const key = p ? p.id + '|' + p.v + '|' + p.imax : ''; if (key !== t.key) { t.key = key; fill(); sync(); }
            if (!p || !live()) { q('[data-u]').textContent = '--'; q('[data-i]').textContent = '--'; return; }
            const [v, i] = valOf(p), e = api.circ.elems.find(x => x.part && x.part.id === p.id && x.type === 'V');
            q('[data-u]').textContent = isFinite(v) ? api.fmt(v, 'V') : '--'; q('[data-i]').textContent = isFinite(i) ? api.fmt(Math.abs(i), 'A') : '--';
            const cc = !!(e && e.cc); q('[data-cv]').className = 'wblamp' + (!cc ? ' on g' : ''); q('[data-cc]').className = 'wblamp' + (cc ? ' on r' : '');
            q('[data-modetxt]').textContent = cc ? 'Strombegrenzung greift: Spannung bricht ein' : 'Konstantspannung';
            q('[data-note]').textContent = !p.imax ? 'Tipp: Ohne Strombegrenzung kann ein Kurzschluss Bauteile zerstören.' : '';
          }
        };
      }
    };

    /* ---------------- Funktionsgenerator ---------------- */
    const fmtHz = f => f >= 1e6 ? (f / 1e6) + 'MHz' : f >= 1e3 ? (+(f / 1e3).toFixed(3)) + 'kHz' : (+f.toFixed(3)) + 'Hz';
    const parseHz = s => { const x = parseVal(s, 'Hz'); return isFinite(x) && x > 0 ? x : NaN; };
    const GEN = {
      name: 'Funktionsgenerator', icon: '〰️', w: 280, sel: 0,
      build(el) {
        el.innerHTML = '<div class="wbc"></div><div class="wbrow" data-waves></div><div class="wbrow"><label class="wbf" style="flex:1">Frequenz<input type="text" data-f inputmode="decimal"></label><label class="wbf" style="flex:1">Amplitude (Spitze, V)<input type="text" data-a inputmode="decimal"></label></div><div class="wbrow"><button class="wbb" data-d10>÷10</button><button class="wbb" data-d2>÷2</button><button class="wbb" data-x2>×2</button><button class="wbb" data-x10>×10</button></div><div class="wbmut" data-note></div>';
        const q = s => el.querySelector(s), t = {};
        const cur = () => S().parts.find(p => p.id === GEN.sel && p.k === 'AC') || partsOf(['AC'])[0] || null;
        const cfg = p => { const g = root.LabGen ? root.LabGen(p.v) : { amp: parseVal((String(p.v).match(/([0-9.,]+)\s*m?V/) || [])[1] || '5', 'V'), freq: 1000 }; const f = String(p.v).replace(',', '.').match(/([0-9]*\.?[0-9]+)\s*([kM]?)\s*Hz/i), a = String(p.v).replace(',', '.').match(/([0-9]*\.?[0-9]+)\s*(m?)\s*V/); return { f: f ? parseFloat(f[1]) * ({ k: 1e3, K: 1e3, M: 1e6 }[f[2]] || 1) : 1000, a: a ? parseFloat(a[1]) * (a[2] === 'm' ? 1e-3 : 1) : 5 }; };
        const wr = (f, a, w) => { const p = cur(); if (!p) return; f = Math.min(Math.max(f, 0.1), 1e6); a = Math.min(Math.max(a, 0.001), 50); p.v = (+a.toFixed(3)) + 'V ' + fmtHz(f); if (w) p.vr = w; mark('gen'); apply(); sync(); };
        const fill = () => { const p = cur(); q('.wbc').innerHTML = p ? partSel(partsOf(['AC']), p.id) : '<div class="wbmut">Kein Generator in der Schaltung. Zeichne eine „Wechselspannung“.</div>'; const sl = q('.wbc select'); if (sl) sl.onchange = () => { GEN.sel = +sl.value; fill(); sync(); }; };
        const sync = () => {
          const p = cur(); if (!p) return; const c = cfg(p);
          q('[data-waves]').innerHTML = [['sin', '∿ Sinus'], ['sq', '⊓ Rechteck'], ['tri', '△ Dreieck']].map(w => `<button class="wbb ${p.vr === w[0] || (!p.vr && w[0] === 'sin') ? 'on' : ''}" data-w="${w[0]}">${w[1]}</button>`).join('');
          q('[data-waves]').querySelectorAll('[data-w]').forEach(b => { b.onclick = () => wr(cfg(p).f, cfg(p).a, b.dataset.w); });
          if (document.activeElement !== q('[data-f]')) q('[data-f]').value = fmtHz(c.f); if (document.activeElement !== q('[data-a]')) q('[data-a]').value = num(c.a, 3).replace(/,?0+$/, '');
          q('[data-note]').textContent = 'Ausgangswiderstand 50 Ω · Spitze-Spitze ' + num(2 * c.a, 2) + ' V';
        };
        q('[data-f]').onchange = () => { const p = cur(), f = parseHz(q('[data-f]').value); if (p && isFinite(f)) wr(f, cfg(p).a); else sync(); };
        q('[data-a]').onchange = () => { const p = cur(), a = parseVal(q('[data-a]').value, 'V'); if (p && isFinite(a)) wr(cfg(p).f, a); else sync(); };
        [['[data-d10]', .1], ['[data-d2]', .5], ['[data-x2]', 2], ['[data-x10]', 10]].forEach(([s, k]) => { q(s).onclick = () => { const p = cur(); if (p) wr(cfg(p).f * k, cfg(p).a); }; });
        fill(); sync(); t.key = '';
        return { update() { const p = cur(), key = p ? p.id + '|' + p.v + '|' + p.vr : ''; if (key !== t.key) { t.key = key; fill(); sync(); } } };
      }
    };

    /* ---------------- Multimeter (Anzeige und Bedienung der Seitenleisten-Karte) ---------------- */
    const DMM = {
      name: 'Multimeter', icon: '📟', w: 280,
      build(el) {
        el.innerHTML = '<div class="wbrow" data-dials></div><div class="wbrow" data-jacks></div><div class="wblcd" data-v>--</div><div class="wbmut" data-sub style="min-height:34px"></div><div class="wbmut" data-acc style="font-size:11px;min-height:28px"></div><div class="wbrow"><button class="wbb" data-probe>Messspitzen setzen</button><button class="wbb" data-fuse>Sicherung tauschen</button></div>';
        const q = s => el.querySelector(s), M = () => api.meter, t = {};
        const DIALS = [['V=', 'V ⎓'], ['V~', 'V ∿'], ['A', 'A'], ['R', 'Ω']], JACKS = [['V', 'VΩ'], ['mA', 'mA'], ['10A', '10 A']];
        const draw = () => {
          q('[data-dials]').innerHTML = DIALS.map(d => `<button class="wbb ${M().dial === d[0] ? 'on' : ''}" data-d="${d[0]}">${d[1]}</button>`).join('');
          q('[data-jacks]').innerHTML = '<small style="color:var(--mute);align-self:center">rote Buchse</small>' + JACKS.map(d => `<button class="wbb ${M().jack === d[0] ? 'on' : ''}" data-j="${d[0]}">${d[1]}</button>`).join('');
          q('[data-dials]').querySelectorAll('button').forEach(b => { b.onclick = () => { api.meterDial(b.dataset.d); mark('dmm'); api.refreshUI(); draw(); }; });
          q('[data-jacks]').querySelectorAll('button').forEach(b => { b.onclick = () => { M().jack = b.dataset.j; api.meterReset(); api.refreshUI(); draw(); }; });
        };
        q('[data-probe]').onclick = () => { if (!api.simMode) { api.setSimMode(true); } api.setTool('meter'); mark('dmm'); };
        q('[data-fuse]').onclick = () => { M().fuse = false; M().fuse10 = false; api.refreshUI(); };
        draw(); t.k = M().dial + M().jack;
        return { update() { const k = M().dial + M().jack; if (k !== t.k) { t.k = k; draw(); } let r = { main: '--', sub: 'Simulation einschalten, dann „Messspitzen setzen“.' }; if (api.simMode && api.tool === 'meter') { try { r = api.meterText(); } catch (e) {} } else if (api.simMode) r.sub = 'Tippe auf „Messspitzen setzen“ und dann auf die Messpunkte in der Schaltung.'; q('[data-v]').textContent = r.main; q('[data-sub]').textContent = r.sub; q('[data-acc]').textContent = root.MESS_PLUS_ACC && api.simMode && api.tool === 'meter' ? root.MESS_PLUS_ACC.dmmAcc(r.main, M().dial) : ''; q('[data-fuse]').disabled = !(M().fuse || M().fuse10); } };
      }
    };

    /* ---------------- Oszilloskop ---------------- */
    const TDIV = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2];
    const VDIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
    const tTxt = t => t >= 1 ? t + ' s' : t >= 1e-3 ? (t * 1e3) + ' ms' : (t * 1e6) + ' µs', vTxt = v => v >= 1 ? v + ' V' : (v * 1e3) + ' mV';
    const OSC = {
      name: 'Oszilloskop', icon: '📈', w: 600, ti: 9,
      ch: [0, 1, 2, 3].map(() => ({ vd: 6, pos: 0, ac: false, px: 1, ps: 1 })), cur: 0, trig: { ch: 0, lv: 0, on: true }, freeze: false, cur1: null, cur2: null, snap: null,
      build(el) {
        el.innerHTML = '<canvas data-cv width="600" height="300" style="width:100%;border-radius:8px;background:#0b1a10;touch-action:none;display:block"></canvas>'
          + '<div class="wbrow" data-chs style="margin-top:6px"></div><div class="wbrow" data-ctl></div><div class="wbrow" data-ctl2></div><div class="wbmeas" data-meas></div>';
        const q = s => el.querySelector(s), cvs = q('[data-cv]'), g = cvs.getContext('2d'), t = {};
        const W = 600, H = 300, DX = 10, DY = 8, sx = W / DX, sy = H / DY;
        const winSet = () => api.setGraphWin(10 * TDIV[OSC.ti]);
        const chData = k => { const b = api.scopeBuf && api.scopeBuf[k]; return b && b.t.length > 1 ? b : null; };
        const screenV = (k, v) => { const c = OSC.ch[k]; return v / c.px; };
        const series = k => {
          const b = chData(k); if (!b) return null; const c = OSC.ch[k];
          let vs = b.v.map(v => screenV(k, v)); if (c.ac) { let m = 0, n = 0; for (let i = 0; i < vs.length; i++) if (isFinite(vs[i])) { m += vs[i]; n++; } m = n ? m / n : 0; vs = vs.map(v => v - m); }
          return { t: b.t, v: vs };
        };
        const trigStart = () => {
          const s = OSC.snap || null, tr = OSC.trig, d = series(tr.ch); const win = 10 * TDIV[OSC.ti];
          if (!d || !tr.on) return d ? Math.max(d.t[0], d.t[d.t.length - 1] - win) : 0;
          const lv = tr.lv, tEnd = d.t[d.t.length - 1], lim = tEnd - win;
          for (let i = 1; i < d.t.length; i++) { if (d.t[i - 1] > lim + 1e-12) break; if (d.t[i - 1] < lv && d.v[i] >= lv && d.t[i - 1] >= d.t[0]) { const f = (lv - d.v[i - 1]) / ((d.v[i] - d.v[i - 1]) || 1); return d.t[i - 1] + f * (d.t[i] - d.t[i - 1]); } }
          return Math.max(d.t[0], lim);
        };
        const measure = (k, t0, win) => {
          const d = series(k); if (!d) return null; const c = OSC.ch[k]; let mn = 1e99, mx = -1e99, sum = 0, sq = 0, n = 0; const xs = [], ys = [];
          for (let i = 0; i < d.t.length; i++) { if (d.t[i] < t0 || d.t[i] > t0 + win || !isFinite(d.v[i])) continue; const v = d.v[i] * c.ps; xs.push(d.t[i]); ys.push(v); mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++; }
          if (n < 3) return null; const mean = sum / n; for (const v of ys) sq += v * v; const rms = Math.sqrt(sq / n);
          const pp = mx - mn, hy = Math.max(pp * 0.1, 1e-9), mid = (mx + mn) / 2; let state = ys[0] > mid, ups = [];
          for (let i = 1; i < ys.length; i++) { if (!state && ys[i] > mid + hy) { state = true; ups.push(xs[i]); } else if (state && ys[i] < mid - hy) state = false; }
          let f = NaN; if (ups.length >= 2) f = (ups.length - 1) / (ups[ups.length - 1] - ups[0]);
          let duty = NaN; if (isFinite(f)) { let hi = 0, tot = 0; for (let i = 1; i < ys.length; i++) { const dt = xs[i] - xs[i - 1]; tot += dt; if (ys[i] > mid) hi += dt; } duty = hi / tot; }
          return { mn, mx, pp, mean, rms, f, T: 1 / f, duty };
        };
        OSC.measure = measure; OSC.series = series;
        const render = () => {
          g.fillStyle = '#0b1a10'; g.fillRect(0, 0, W, H);
          g.strokeStyle = '#1f4a2a'; g.lineWidth = 1; g.beginPath();
          for (let i = 0; i <= DX; i++) { g.moveTo(i * sx, 0); g.lineTo(i * sx, H); } for (let j = 0; j <= DY; j++) { g.moveTo(0, j * sy); g.lineTo(W, j * sy); } g.stroke();
          g.strokeStyle = '#2c6b3b'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
          g.strokeStyle = '#2c6b3b'; for (let i = 0; i < DX * 5; i++) { const x = i * sx / 5; g.beginPath(); g.moveTo(x, H / 2 - 3); g.lineTo(x, H / 2 + 3); g.stroke(); } for (let j = 0; j < DY * 5; j++) { const y = j * sy / 5; g.beginPath(); g.moveTo(W / 2 - 3, y); g.lineTo(W / 2 + 3, y); g.stroke(); }
          const nch = (S().scopes || []).length, win = 10 * TDIV[OSC.ti], t0 = trigStart();
          if (!OSC.freeze) OSC.snap = null;
          for (let k = 0; k < Math.min(nch, 4); k++) {
            const d = series(k); if (!d) continue; const c = OSC.ch[k]; g.strokeStyle = LANECOL[k]; g.lineWidth = 2; g.beginPath(); let first = true;
            for (let i = 0; i < d.t.length; i++) { const x = (d.t[i] - t0) / win * W; if (x < 0 || x > W || !isFinite(d.v[i])) continue; const y = H / 2 - (d.v[i] / VDIV[c.vd] + c.pos) * sy; if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
            g.stroke(); g.fillStyle = LANECOL[k]; g.font = '700 11px sans-serif'; g.textAlign = 'left'; const ym = H / 2 - c.pos * sy; g.fillText('▶' + (k + 1), 1, Math.min(H - 4, Math.max(12, ym + 4)));
          }
          // Triggerpfeil
          const tc = OSC.ch[OSC.trig.ch]; if (tc && OSC.trig.on) { const y = H / 2 - (OSC.trig.lv / VDIV[tc.vd] + tc.pos) * sy; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(W, y); g.lineTo(W - 9, y - 5); g.lineTo(W - 9, y + 5); g.fill(); }
          // Cursor
          [OSC.cur1, OSC.cur2].forEach((c, i) => { if (c == null) return; g.strokeStyle = i ? '#ff9ad5' : '#7ad7ff'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(c * W, 0); g.lineTo(c * W, H); g.stroke(); g.setLineDash([]); });
          if (!nch) { g.fillStyle = '#9fe3b0'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Keine Messpunkte. Unten „Messpunkt setzen“ und dann Bauteil oder Draht antippen.', W / 2, H / 2 - 10); }
          g.fillStyle = '#9fe3b0'; g.font = '12px sans-serif'; g.textAlign = 'right'; g.fillText(tTxt(TDIV[OSC.ti]) + '/Teil' + (OSC.freeze ? ' · STOP' : ''), W - 6, H - 6);
          // Messwerte
          const m = q('[data-meas]'), k = Math.min(OSC.cur, Math.max(0, nch - 1)); const r = nch ? measure(k, t0, win) : null;
          let h = '<b style="color:' + LANECOL[k] + '">K' + (k + 1) + '</b> ';
          if (r) h += `Uss ${api.fmt(r.pp, 'V')} · Umax ${api.fmt(r.mx, 'V')} · Umin ${api.fmt(r.mn, 'V')} · Ueff ${api.fmt(r.rms, 'V')} · Umittel ${api.fmt(r.mean, 'V')}` + (isFinite(r.f) ? ` · f ${api.fmt(r.f, 'Hz')} · T ${api.fmt(r.T, 's')}` + (r.duty > .02 && r.duty < .98 ? ` · Tastgrad ${num(r.duty * 100, 0)} %` : '') : '');
          else h += '<span style="color:var(--mute)">noch keine Messwerte (Simulation starten)</span>';
          if (OSC.cur1 != null) { const a = OSC.cur1 * win, b = OSC.cur2 != null ? OSC.cur2 * win : null; h += `<br>Cursor 1: ${api.fmt(a, 's')}` + (b != null ? ` · Cursor 2: ${api.fmt(b, 's')} · Δt ${api.fmt(Math.abs(b - a), 's')} · 1/Δt ${api.fmt(1 / Math.max(Math.abs(b - a), 1e-12), 'Hz')}` : ' (zweiten Cursor mit zweitem Tipp setzen)'); }
          m.innerHTML = h;
        };
        const ctl = () => {
          const c = OSC.ch[OSC.cur], nch = (S().scopes || []).length;
          q('[data-chs]').innerHTML = [0, 1, 2, 3].map(k => `<button class="wbb ${OSC.cur === k ? 'on' : ''}" data-k="${k}" style="color:${LANECOL[k]};${k >= nch ? 'opacity:.45' : ''}">K${k + 1}</button>`).join('') + `<button class="wbb" data-set>＋ Messpunkt setzen</button><button class="wbb" data-clr ${nch ? '' : 'disabled'}>Messpunkte löschen</button>`;
          q('[data-ctl]').innerHTML = `<span class="wbtag">Zeit</span><button class="wbb" data-tm>−</button><b class="wbv">${tTxt(TDIV[OSC.ti])}/T</b><button class="wbb" data-tp>＋</button><span class="wbtag">Volt K${OSC.cur + 1}</span><button class="wbb" data-vm>−</button><b class="wbv">${vTxt(VDIV[c.vd])}/T</b><button class="wbb" data-vp>＋</button><span class="wbtag">Lage</span><button class="wbb" data-pd>▼</button><button class="wbb" data-pu>▲</button>`;
          q('[data-ctl2]').innerHTML = `<button class="wbb ${c.ac ? 'on' : ''}" data-ac>${c.ac ? 'AC' : 'DC'}-Kopplung</button><button class="wbb ${c.px === 10 ? 'on' : ''}" data-px>Tastkopf-Schalter ×${c.px}</button><button class="wbb ${c.ps === 10 ? 'on' : ''}" data-ps>Kanal-Faktor ×${c.ps}</button><button class="wbb ${OSC.trig.on ? 'on' : ''}" data-tr>Trigger ${OSC.trig.on ? 'an' : 'aus'}</button><button class="wbb" data-tl>Pegel −</button><b class="wbv">${num(OSC.trig.lv, 2)} V</b><button class="wbb" data-tu>Pegel ＋</button><button class="wbb ${OSC.freeze ? 'on' : ''}" data-fr>${OSC.freeze ? '▶ Weiter' : '⏸ Stop'}</button><button class="wbb" data-cc>Cursor</button>`;
          const B = s => q(s), on = (s, f) => { const b = B(s); if (b) b.onclick = f; };
          q('[data-chs]').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { OSC.cur = +b.dataset.k; OSC.trig.ch = OSC.cur; ctl(); }; });
          on('[data-set]', () => { if (!api.simMode) api.setSimMode(true); api.setTool('scope'); api.toast('Bauteil oder Draht antippen, den du am Oszilloskop sehen willst'); mark('osc'); });
          on('[data-clr]', () => { S().scopes.length = 0; api.setGraphWin(10 * TDIV[OSC.ti]); apply(); ctl(); });
          on('[data-tm]', () => { OSC.ti = Math.max(0, OSC.ti - 1); winSet(); ctl(); }); on('[data-tp]', () => { OSC.ti = Math.min(TDIV.length - 1, OSC.ti + 1); winSet(); ctl(); });
          on('[data-vm]', () => { c.vd = Math.max(0, c.vd - 1); ctl(); }); on('[data-vp]', () => { c.vd = Math.min(VDIV.length - 1, c.vd + 1); ctl(); });
          on('[data-pd]', () => { c.pos -= .5; }); on('[data-pu]', () => { c.pos += .5; });
          on('[data-ac]', () => { c.ac = !c.ac; ctl(); }); on('[data-px]', () => { c.px = c.px === 1 ? 10 : 1; ctl(); }); on('[data-ps]', () => { c.ps = c.ps === 1 ? 10 : 1; ctl(); });
          on('[data-tr]', () => { OSC.trig.on = !OSC.trig.on; ctl(); }); on('[data-tl]', () => { OSC.trig.lv -= VDIV[c.vd] / 2; ctl(); }); on('[data-tu]', () => { OSC.trig.lv += VDIV[c.vd] / 2; ctl(); });
          on('[data-fr]', () => { OSC.freeze = !OSC.freeze; ctl(); }); on('[data-cc]', () => { OSC.cur1 = null; OSC.cur2 = null; });
        };
        cvs.onpointerdown = e => { const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; if (OSC.cur1 == null || OSC.cur2 != null) { OSC.cur1 = x; OSC.cur2 = null; } else OSC.cur2 = x; mark('osc'); };
        winSet(); ctl(); t.n = -1;
        return { update() { const n = (S().scopes || []).length; if (n !== t.n) { t.n = n; ctl(); } if (!OSC.freeze || !t.frozen) { render(); } t.frozen = OSC.freeze; if (!OSC.freeze) t.frozen = false; }, redraw: render };
      }
    };

    /* ---------------- Frequenzzähler und Leistungsmesser (laufen mit jedem Simulationsschritt) ---------------- */
    const CNT = { name: 'Frequenzzähler', icon: '🔢', w: 250, k: 0, st: null };
    CNT.build = el => {
      el.innerHTML = '<div class="wbrow" data-chs></div><div class="wblcd" data-f>--</div><div class="wbmut" data-sub>Zählt die Perioden des Messpunkts, den du am Oszilloskop gesetzt hast.</div>';
      const q = s => el.querySelector(s);
      return { update() {
        const n = (S().scopes || []).length; if (CNT.k >= n) CNT.k = 0;
        q('[data-chs]').innerHTML = n ? [...Array(n).keys()].map(k => `<button class="wbb ${CNT.k === k ? 'on' : ''}" data-k="${k}" style="color:${LANECOL[k]}">K${k + 1}</button>`).join('') : '<span class="wbmut">Erst am Oszilloskop einen Messpunkt setzen.</span>';
        q('[data-chs]').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { CNT.k = +b.dataset.k; CNT.st = null; }; });
        const s = CNT.st, f = s && s.f; q('[data-f]').textContent = isFinite(f) ? api.fmt(f, 'Hz') : '--'; q('[data-sub]').textContent = isFinite(f) ? 'Periodendauer ' + api.fmt(1 / f, 's') : 'Zählt die Perioden des Messpunkts, den du am Oszilloskop gesetzt hast.'; if (isFinite(f)) mark('cnt');
      } };
    };
    const PWR = { name: 'Leistungsmesser', icon: '⚡', w: 260, sel: 0, st: null, E: 0 };
    PWR.build = el => {
      el.innerHTML = '<div class="wbc"></div><div class="wblcd" data-p>--</div><div class="wbrow"><div class="wbd"><small>Spannung</small><b data-u>--</b></div><div class="wbd"><small>Strom</small><b data-i>--</b></div></div><div class="wbmut" data-x></div><button class="wbb" data-rst>Energie zurücksetzen</button>';
      const q = s => el.querySelector(s), t = {};
      const list = () => S().parts.filter(p => p.k !== 'GND');
      const fill = () => { const l = list(); if (!l.some(p => p.id === PWR.sel)) { const ld = l.find(p => !['BAT', 'AC'].includes(p.k)) || l[0]; PWR.sel = ld ? ld.id : 0; } q('.wbc').innerHTML = l.length ? partSel(l, PWR.sel) : '<div class="wbmut">Keine Bauteile.</div>'; const sl = q('.wbc select'); if (sl) sl.onchange = () => { PWR.sel = +sl.value; PWR.st = null; PWR.E = 0; }; };
      q('[data-rst]').onclick = () => { PWR.E = 0; };
      fill(); t.n = list().length;
      return { update() { if (list().length !== t.n) { t.n = list().length; fill(); } const s = PWR.st; if (!s) { q('[data-p]').textContent = '--'; return; } q('[data-p]').textContent = api.fmt(Math.abs(s.P), 'W') + (s.P < -1e-9 ? ' ◂ liefert' : ''); q('[data-u]').textContent = api.fmt(s.U, 'V'); q('[data-i]').textContent = api.fmt(s.I, 'A'); q('[data-x]').textContent = 'Scheinleistung ' + api.fmt(s.S, 'VA') + ' · cos φ ' + num(s.cos, 2) + ' · Energie ' + api.fmt(PWR.E / 3600, 'Wh'); mark('pwr'); } };
    };
    root.LAB_STEP = dt => {
      if (CNT.on && S().scopes && S().scopes[CNT.k]) {
        const v = api.scopeValues(S().scopes[CNT.k])[0], t = api.sim.t; let s = CNT.st;
        if (!s || t < s.t) s = CNT.st = { hi: v, lo: v, up: false, ups: [], f: NaN, t: t, init: false };
        s.t = t; const al = Math.min(1, dt / 0.05); s.hi = Math.max(v, s.hi + (v - s.hi) * al * 0.2); s.lo = Math.min(v, s.lo + (v - s.lo) * al * 0.2);
        const mid = (s.hi + s.lo) / 2, hy = Math.max((s.hi - s.lo) * 0.15, 1e-6);
        if (!s.up && v > mid + hy) { s.up = true; if (s.hi - s.lo > 1e-4) { s.ups.push(t); if (s.ups.length > 12) s.ups.shift(); if (s.ups.length >= 2) s.f = (s.ups.length - 1) / (s.ups[s.ups.length - 1] - s.ups[0]); } } else if (s.up && v < mid - hy) s.up = false;
      }
      if (PWR.on) {
        const p = S().parts.find(x => x.id === PWR.sel); if (!p) return;
        const [v, i] = api.scopeValues({ t: 'part', id: p.id }); if (!isFinite(v) || !isFinite(i)) return;
        let s = PWR.st; if (!s || api.sim.t < s.t) s = PWR.st = { P: 0, U2: 0, I2: 0, t: api.sim.t, U: 0, I: 0, S: 0, cos: 1 };
        s.t = api.sim.t; const al = Math.min(1, dt / 0.04);
        s.P += al * (v * i - s.P); s.U2 += al * (v * v - s.U2); s.I2 += al * (i * i - s.I2);
        s.U = Math.sqrt(Math.max(s.U2, 0)); s.I = Math.sqrt(Math.max(s.I2, 0)); s.S = s.U * s.I; s.cos = s.S > 1e-12 ? Math.max(-1, Math.min(1, s.P / s.S)) : 1; PWR.E += Math.abs(v * i) * dt;
      }
    };

    /* ---------------- Kennlinienschreiber ---------------- */
    const TRACE = { name: 'Kennlinienschreiber', icon: '📉', w: 420, sel: 0, pts: null, curve: null };
    const TRACE_KINDS = ['R', 'D', 'LED', 'ZD', 'NTC', 'PTC', 'LDR', 'LAMP', 'FUSE'];
    const RANGE = { R: [10, 10], D: [4, 12], LED: [5, 6], ZD: [4, 14], NTC: [10, 10], PTC: [10, 10], LDR: [10, 10], LAMP: [10, 10], FUSE: [1, 1] };
    function sweep(p) {
      const rng = RANGE[p.k] || [10, 10], out = [];
      [[true, rng[0]], [false, rng[1]]].forEach(([fwd, umax]) => {
        const rows = [['BAT', 2, 4, 1, '0', { vr: 'psu' }], ['R', 2, 2, 0, '100'], [p.k, 6, fwd ? 2 : 6, fwd ? 1 : 3, p.v, { defect: p.defect, vr: p.vr, pos: p.pos }], ['GND', 2, 8]];
        const parts = api.mkParts(rows), segs = [[2, 4, 2, 2], [6, 6, 6, 8], [6, 8, 2, 8]], tmp = { name: 'tmp', parts, wires: segs.map((s, i) => ({ id: i + 1, x1: s[0], y1: s[1], x2: s[2], y2: s[3] })), nid: 9000, scopes: [] };
        api.withSch(tmp, () => {
          for (let k = 0; k <= 40; k++) {
            const u = umax * k / 40; parts[0].v = String(u);
            try { const E = api.simEval(); E.run(0.012); const dut = parts[2], e = E.c.elems.filter(x => x.part && x.part.id === dut.id)[0]; if (!e) continue; const U = api.vAcross(E, dut), I = e.type === 'V' ? -e.i : e.i; if (isFinite(U) && isFinite(I)) out.push([U, I]); } catch (e) { }
          }
        });
      });
      out.sort((a, b) => a[0] - b[0]); return out;
    }
    TRACE.build = el => {
      el.innerHTML = '<div class="wbc"></div><div class="wbrow"><button class="wbb on" data-go>Kennlinie aufnehmen</button><span class="wbmut" data-st></span></div><canvas data-cv width="420" height="260" style="width:100%;border-radius:8px;background:#0b1a10;touch-action:none;display:block"></canvas><div class="wbmeas" data-meas>Bauteil wählen, „Kennlinie aufnehmen“ tippen, dann in die Kurve tippen: Du siehst Spannung, Strom und statischen Widerstand.</div>';
      const q = s => el.querySelector(s), cvs = q('[data-cv]'), g = cvs.getContext('2d'), W = 420, H = 260, t = {};
      const list = () => S().parts.filter(p => TRACE_KINDS.includes(p.k));
      const cur = () => list().find(p => p.id === TRACE.sel) || list().find(p => p.k !== 'R') || list()[0] || null;
      const fill = () => { const l = list(); q('.wbc').innerHTML = l.length ? partSel(l, (cur() || {}).id) : '<div class="wbmut">Zeichne ein Bauteil (Widerstand, Diode, LED, Z-Diode, NTC …), das du ausmessen willst.</div>'; const sl = q('.wbc select'); if (sl) sl.onchange = () => { TRACE.sel = +sl.value; TRACE.curve = null; }; };
      const plot = () => {
        g.fillStyle = '#0b1a10'; g.fillRect(0, 0, W, H); const c = TRACE.curve; g.strokeStyle = '#1f4a2a'; g.lineWidth = 1;
        if (!c || !c.pts.length) { g.fillStyle = '#9fe3b0'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText('Noch keine Kennlinie', W / 2, H / 2); return; }
        const us = c.pts.map(p => p[0]), is = c.pts.map(p => p[1]); const umin = Math.min(0, ...us), umax = Math.max(0.1, ...us), imin = Math.min(0, ...is), imax = Math.max(1e-6, ...is);
        const X = u => 24 + (u - umin) / (umax - umin) * (W - 34), Y = i => H - 22 - (i - imin) / (imax - imin) * (H - 34);
        g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
        g.strokeStyle = '#6dff7a'; g.lineWidth = 2; g.beginPath(); c.pts.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); if (!i) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke();
        g.fillStyle = '#9fe3b0'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(api.fmt(imax, 'A'), 28, 12); g.textAlign = 'right'; g.fillText(api.fmt(umax, 'V'), W - 4, Y(0) - 4); g.fillText('U', W - 4, H - 6); g.textAlign = 'left'; g.fillText('I', X(0) + 4, 24);
        const p = cur(); if (live() && p) { const [v, i] = valOf(p); if (isFinite(v) && isFinite(i)) { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(X(v), Y(i), 5, 0, 7); g.fill(); } }
        if (t.mark) { g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(X(t.mark[0]), Y(t.mark[1]), 5, 0, 7); g.stroke(); }
        t.X = X; t.Y = Y; t.umin = umin; t.umax = umax;
      };
      cvs.onpointerdown = e => { const c = TRACE.curve; if (!c || !t.X) return; const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; let best = null, bd = 1e9; c.pts.forEach(p => { const d = Math.abs(t.X(p[0]) - x); if (d < bd) { bd = d; best = p; } }); if (best) { t.mark = best; q('[data-meas]').innerHTML = `U = <b>${api.fmt(best[0], 'V')}</b> · I = <b>${api.fmt(best[1], 'A')}</b>` + (Math.abs(best[1]) > 1e-9 ? ` · statischer Widerstand U/I = <b>${api.fmt(Math.abs(best[0] / best[1]), 'Ω')}</b>` : ''); plot(); } };
      q('[data-go]').onclick = () => { const p = cur(); if (!p) return; q('[data-st]').textContent = 'rechne …'; setTimeout(() => { try { TRACE.curve = { id: p.id, pts: sweep(p) }; t.mark = null; mark('trace'); q('[data-st]').textContent = TRACE.curve.pts.length + ' Messpunkte'; } catch (e) { q('[data-st]').textContent = 'Fehler: ' + e.message; } plot(); }, 20); };
      fill(); t.n = list().length; plot();
      return { update() { if (list().length !== t.n) { t.n = list().length; fill(); } plot(); } };
    };

    const INST = { psu: PSU, gen: GEN, dmm: DMM, osc: OSC, cnt: CNT, pwr: PWR, trace: TRACE };
    const ORDER = ['psu', 'gen', 'dmm', 'osc', 'cnt', 'pwr', 'trace'];
    api.INST = INST;
    if (root.MESS_PLUS) root.MESS_PLUS(api, { INST, ORDER, partsOf, partSel, mark, S, esc, num, LANECOL, fmtHz, parseHz, OSC, TDIV, parseVal });

    /* ---------------- Werkbank: Rahmen, feste und freie Ansicht ---------------- */
    let dock = null, bodies = {}, timer = null, upd = {};
    const css = document.createElement('style');
    css.textContent = '.wbdock{display:flex;flex-direction:column;background:var(--panel);border-top:2px solid var(--accent);flex:none;height:50vh;min-height:0}.wbbar{display:flex;gap:6px;align-items:center;padding:6px 8px;overflow-x:auto;flex:none;border-bottom:1px solid var(--line)}.wbbar b{white-space:nowrap}.wbrowwrap{display:flex;gap:10px;padding:8px;overflow-x:auto;overflow-y:hidden;align-items:stretch;flex-wrap:nowrap;flex:1;min-height:0}.wbi:not(.free){flex:none;max-height:100%;overflow-y:auto}'
      + '.wbi canvas{position:static!important;inset:auto!important;width:100%!important;height:auto!important}.wbi{background:#1b2127;border:1px solid #38424d;border-radius:12px;color:var(--fg);box-shadow:0 4px 16px rgba(0,0,0,.35)}.wbi.free{position:fixed;z-index:90;max-width:96vw;max-height:80vh;overflow:auto}.wbh{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;font-weight:700;font-size:13px;background:#2a323b;border-radius:12px 12px 0 0;cursor:grab;user-select:none;touch-action:none}.wbh button{width:26px;height:26px;color:var(--mute)}.wbm{padding:8px 10px 10px}'
      + '.wbrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}.wbb{height:30px;padding:0 10px;border-radius:8px;background:#2c343e;border:1px solid #46525f;font-size:12px;font-weight:600;color:var(--fg)}.wbb.on{background:var(--accent);border-color:var(--accent);color:#fff}.wbb[disabled]{opacity:.4}.wbtag{font-size:11px;color:var(--mute);margin-left:4px}.wbv{font-size:12px;min-width:56px;text-align:center}'
      + '.wbd{flex:1;background:#0f1418;border-radius:8px;padding:5px 8px}.wbd small{display:block;color:var(--mute);font-size:10px;text-transform:uppercase}.wbd b{font:700 19px ui-monospace,Menlo,Consolas,monospace;color:#7dff9a}.wbmut{color:var(--mute);font-size:12px}.wblcd{font:600 28px/1.15 ui-monospace,Menlo,Consolas,monospace;background:#c9d99d;color:#1d2a0c;border-radius:8px;padding:5px 10px;text-align:right;border:2px solid #7b8a58}'
      + '.wblamp{padding:2px 9px;border-radius:10px;background:#2a2f35;color:#666;font-weight:800;font-size:12px}.wblamp.on.g{background:#2fae45;color:#fff}.wblamp.on.r{background:#e04b3a;color:#fff}.wbf{display:block;font-size:12px;color:var(--mute);margin:6px 0}.wbf input[type=text]{height:32px;font-size:14px;margin-top:2px}.wbf input[type=range]{height:26px;margin-top:2px}.wbsel{height:32px;font-size:13px;margin-bottom:4px}.wbmeas{font-size:12px;line-height:1.5;margin-top:6px;color:#d6e6dc}';
    document.head.appendChild(css);

    function ensure(id) {
      if (bodies[id]) return bodies[id];
      const I = INST[id], el = document.createElement('div'); el.className = 'wbi'; el.dataset.id = id; el.style.width = I.w + 'px'; el.style.maxWidth = '100%';
      el.innerHTML = `<div class="wbh"><span>${I.icon} ${I.name}</span><button data-x aria-label="Schließen">✕</button></div><div class="wbm"></div>`;
      el.querySelector('[data-x]').onclick = () => toggle(id, false);
      const inst = I.build(el.querySelector('.wbm')); upd[id] = inst;
      const h = el.querySelector('.wbh'); let dr = null;
      h.onpointerdown = e => { if (wb.mode !== 'free' || e.target.closest('button')) return; const r = el.getBoundingClientRect(); dr = { dx: e.clientX - r.left, dy: e.clientY - r.top }; h.setPointerCapture(e.pointerId); };
      h.onpointermove = e => { if (!dr) return; const x = Math.max(0, Math.min(innerWidth - 80, e.clientX - dr.dx)), y = Math.max(0, Math.min(innerHeight - 40, e.clientY - dr.dy)); el.style.left = x + 'px'; el.style.top = y + 'px'; wb.pos[id] = [x, y]; };
      h.onpointerup = () => { if (dr) { dr = null; save(); } };
      bodies[id] = el; return el;
    }
    function place() {
      if (!dock) return; const row = dock.querySelector('.wbrowwrap'); row.innerHTML = '';
      let k = 0;
      ORDER.forEach(id => {
        const el = ensure(id), on = !!wb.open[id];
        if (!on) { if (el.parentNode) el.parentNode.removeChild(el); return; }
        if (wb.mode === 'dock') { el.classList.remove('free'); el.style.left = el.style.top = ''; row.appendChild(el); }
        else { el.classList.add('free'); const p = wb.pos[id] || [40 + k * 34, 70 + k * 34]; el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; document.body.appendChild(el); k++; }
      });
      row.style.display = wb.mode === 'dock' ? 'flex' : 'none';
      dock.style.height = wb.mode === 'dock' ? '50vh' : 'auto';
      dock.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', !!wb.open[b.dataset.t]));
      dock.querySelector('[data-mode]').textContent = wb.mode === 'dock' ? '⧉ Frei' : '⬓ Fest';
      CNT.on = !!wb.open.cnt; PWR.on = !!wb.open.pwr;
      setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
    }
    function toggle(id, on) { wb.open[id] = on == null ? !wb.open[id] : on; if (wb.open[id] && id === 'osc') { api.setGraphWin(10 * TDIV[OSC.ti]); } save(); place(); }
    function openBench() {
      if (!dock) {
        dock = document.createElement('div'); dock.className = 'wbdock';
        dock.innerHTML = '<div class="wbbar"><b>🔧 Werkbank</b>' + ORDER.map(id => `<button class="wbb" data-t="${id}">${INST[id].icon} ${INST[id].name}</button>`).join('') + '<span style="flex:1"></span><button class="wbb" data-mode></button><button class="wbb" data-close>✕</button></div><div class="wbrowwrap"></div>';
        dock.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => toggle(b.dataset.t); });
        dock.querySelector('[data-mode]').onclick = () => { wb.mode = wb.mode === 'dock' ? 'free' : 'dock'; save(); place(); };
        dock.querySelector('[data-close]').onclick = closeBench;
        const pal = document.getElementById('pal'); pal.parentNode.insertBefore(dock, pal);
      }
      dock.style.display = '';
      if (!api.simMode && api.sch.parts.length) api.setSimMode(true);
      place(); if (!timer) timer = setInterval(() => { if (!dock || dock.style.display === 'none') return; ORDER.forEach(id => { if (wb.open[id] && upd[id]) { try { upd[id].update(); } catch (e) { console.error(id, e); } } }); }, 120);
      stat('bench', 1, 'max');
    }
    function closeBench() { if (dock) { dock.style.display = 'none'; ORDER.forEach(id => { const el = bodies[id]; if (el && el.parentNode) el.parentNode.removeChild(el); }); } CNT.on = false; PWR.on = false; setTimeout(() => window.dispatchEvent(new Event('resize')), 30); }
    root.MESS_BENCH = { open: openBench, close: closeBench, toggle, INST, parseVal, wb: () => wb, osc: OSC, cnt: CNT, pwr: PWR, trace: TRACE, upd: () => upd, sweep };

    root.LAB_EXTRA_MENU = () => [['wb', 'Werkbank', 'Messgeräte: Netzgerät, Generator, Multimeter, Oszilloskop …']];
    root.LAB_EXTRA_ACT = m => { if (m === 'wb') { openBench(); return true; } return false; };
    root.LAB_EXTRA_CARD = () => '<div class="card"><h4>Werkbank</h4><div class="row2"><button class="btn pri" data-a="wbo">Messgeräte öffnen</button></div><p class="hint2" style="margin:0">Netzgerät, Funktionsgenerator, Multimeter, Oszilloskop, Frequenzzähler, Leistungsmesser, Kennlinienschreiber. Fest unten oder frei verschiebbar.</p></div>';
    root.LAB_EXTRA_CLICK = a => { if (a === 'wbo') { openBench(); return true; } return false; };
    root.GRAPH_KEEP = 1.7;
    root.LAB_HELP = () => `<p><b>Werkbank:</b> Der Knopf „Messgeräte öffnen“ rechts (oder Menü „Werkbank“) öffnet die Geräte. Oben in der Leiste schaltest du jedes Gerät ein oder aus. „Frei“ macht aus den Geräten verschiebbare Fenster, „Fest“ legt sie wieder in die Leiste.</p>
      <p><b>Messen:</b> Auf „Sim“ stellen. Beim Multimeter „Messspitzen setzen“, dann erst den roten, dann den schwarzen Punkt antippen. Beim Strom das Bauteil antippen. Beim Oszilloskop „Messpunkt setzen“ und ein Bauteil oder einen Draht antippen.</p>
      <p><b>Geräte:</b> Netzgerät (Spannung und Strombegrenzung), Funktionsgenerator (Kurvenform, Frequenz, Amplitude), Multimeter, Oszilloskop (Zeit, Volt, Trigger, Cursor), Frequenzzähler, Leistungsmesser, Kennlinienschreiber.</p>
      <p><b>Aufgaben:</b> Du misst, trägst die Zahl in das Feld ein (Einheit darf dabei stehen, zum Beispiel „250mA“), und das Lab prüft sie gegen den simulierten Wert.</p>
      <p><b>Zeichnen:</b> Bauteil unten wählen, auf die Fläche tippen, Drähte ziehen, Entf löscht, Esc oder Rechtsklick beendet das Werkzeug.</p>`;
    if (root.MESS_DATA) root.MESS_DATA(api);
  };
})(window);
