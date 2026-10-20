'use strict';
/* Tonfunk Verbund: Adapter für Arduino-Lab (code) und Pi-Lab (pi) (Paket A1b, SPEC 5.5; bei der Zusammenführung nachgeliefert).
   Das Programm liegt im Hook LabVerbund (code() / setCode(), Quelle quelle/schaltplan/12-drucken-start.js), die Läufer in verbundrun.js.
   apply   : sichert das bisherige Programm (localStorage verbund.ad.mcu.bak.<lab>) und setzt den Rahmen: Musterlösung (ctx.solution.data.src) vor
             station.frame(ctx) vor station.starter(ctx).src; beim Pi-Lab werden Daten (station.dataFor(ctx), Kopfzeile `daten = ...`) eingesetzt.
   collect : code.sketch { lang:'arduino', src, run?:{ serial:[…], events:[] } }; run entsteht nur, wenn die Station `probe(ctx)` (Prüfszenario für
             Verbund.runSketch) hat. pi.script { lang:'python', src, out:[Zeilen] } aus einem Lauf mit Verbund.runPython (Daten aus station.dataFor(ctx)).
   live    : Übersetzungs- und Laufzeitfehler ohne Prüfung.
   Reine Teile in adapter.pure (Node-tauglich, quelle/verbund/test_verbundad_mcu.js). */
(function (root) {
  const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const isS = x => typeof x === 'string';
  const fn = (x, ctx) => { try { return typeof x === 'function' ? x(ctx) : x; } catch (e) { return null; } };
  const hook = () => root.LabVerbund || null;
  const VV = () => root.Verbund || null;
  const ls = { get: k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} } };
  const EMPTY = { arduino: 'void setup() {\n}\n\nvoid loop() {\n}\n', python: '' };

  /* ---------------- reine Teile ---------------- */
  /* Programmrahmen: Musterlösung > station.frame > Starter > leerer Rahmen; Pi: Daten in den Kopf */
  function frameOf(lab, st, ctx) {
    const lang = lab === 'pi' ? 'python' : 'arduino';
    if (ctx && ctx.solution && isO(ctx.solution.data) && isS(ctx.solution.data.src)) return ctx.solution.data.src;
    let src = fn(st && st.frame, ctx);
    if (!isS(src)) { const s0 = fn(st && st.starter, ctx); src = isO(s0) && isS(s0.src) ? s0.src : EMPTY[lang]; }
    if (lab === 'pi') {
      const d = fn(st && (st.dataFor || st.stationData), ctx), V = VV();
      if (isO(d) && V && V.injectData && !/^daten\s*=/m.test(src)) src = V.injectData(src, d).src;
    }
    return src;
  }
  function probeOf(st, ctx) { const p = fn(st && st.probe, ctx); return isO(p) ? p : null; }
  /* Lauf des Sketches im Kern: { serial, events, error } */
  function runProbe(src, scen) {
    const V = VV(); if (!V || typeof V.runSketch !== 'function') return { error: 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen.' };
    const r = V.runSketch(src, scen);
    return { serial: (r.lines || []).slice(0, 400), events: [], error: r.ok ? '' : (r.error || 'Lauf fehlgeschlagen'), phase: r.phase };
  }
  function runPy(src, data, T) {
    const V = VV(); if (!V || typeof V.runPython !== 'function') return { error: 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen.', out: [] };
    const r = V.runPython(src, data || null, { T: T || 30 });
    return { out: (r.lines || []).slice(0, 400), error: r.ok ? '' : (r.error || 'Lauf fehlgeschlagen'), phase: r.phase };
  }
  function buildSketch(st, ctx, src) {
    const data = { lang: 'arduino', src: String(src) }, scen = probeOf(st, ctx);
    if (scen) { const r = runProbe(src, scen); data.run = { serial: r.serial || [], events: r.events || [] }; return { data, err: r.error || '' }; }
    return { data, err: '' };
  }
  function buildScript(st, ctx, src) {
    const d = fn(st && (st.dataFor || st.stationData), ctx), r = runPy(src, isO(d) ? d : null, st && st.runT);
    return { data: { lang: 'python', src: String(src), out: r.out || [] }, err: r.error || '' };
  }
  /* Live-Hinweise */
  function liveRows(lab, st, ctx, src) {
    const rows = [], empty = !String(src || '').trim() || String(src).replace(/\s/g, '') === String(EMPTY.arduino).replace(/\s/g, '');
    rows.push({ ok: !empty, text: empty ? 'Im Lab steht noch kein eigenes Programm' : 'Programm hat ' + String(src).split('\n').length + ' Zeilen' });
    if (empty) return rows;
    if (lab === 'code') {
      const AR = root.Arduino; if (AR && AR.compile) { const c = AR.compile(String(src)); rows.push({ ok: !!c.ok, text: c.ok ? 'Das Programm lässt sich übersetzen' : 'Übersetzungsfehler, Zeile ' + (c.errors && c.errors[0] ? c.errors[0].line + ': ' + c.errors[0].msg : '?') }); }
    } else {
      const PY = root.PyRun; if (PY && PY.compile) { const c = PY.compile(String(src)); rows.push({ ok: !!c.ok, text: c.ok ? 'Das Programm ist syntaktisch in Ordnung' : 'Syntaxfehler, Zeile ' + (c.errors && c.errors[0] ? c.errors[0].line + ': ' + c.errors[0].msg : '?') }); }
    }
    return rows;
  }

  /* ---------------- Lab-Anbindung ---------------- */
  function adapterFor(lab) {
    const bakKey = 'verbund.ad.mcu.bak.' + lab;
    return {
      lab,
      ready() { const H = hook(); return !!(H && H.ready && H.ready() && typeof H.code === 'function'); },
      apply(st, ctx) {
        const H = hook(); if (!H || typeof H.setCode !== 'function') return { ok: false, msg: 'Das Lab ist noch nicht bereit.' };
        const old = H.code(), src = frameOf(lab, st, ctx || {});
        if (isS(old) && old.trim() && old !== src) ls.set(bakKey, JSON.stringify({ t: Date.now(), src: old }));
        if (!H.setCode(src)) return { ok: false, msg: 'Das Programm konnte nicht ins Lab geladen werden (offene Aufgabe? Beende sie im Lab).' };
        return { ok: true, msg: (ctx && ctx.solution ? 'Musterlösung geladen. ' : 'Programmrahmen geladen. ') + (isS(old) && old.trim() && old !== src ? 'Dein bisheriges Programm ist gesichert.' : '') };
      },
      collect(st, ctx) {
        const H = hook(); if (!H) return { error: 'Das Lab ist nicht bereit.' };
        const src = H.code(); if (!isS(src) || !src.trim()) return { error: 'Im Lab steht noch kein Programm.' };
        const b = lab === 'pi' ? buildScript(st, ctx || {}, src) : buildSketch(st, ctx || {}, src);
        return { type: lab === 'pi' ? 'pi.script' : 'code.sketch', data: b.data, runError: b.err || undefined };
      },
      live(st, ctx) { const H = hook(); return liveRows(lab, st, ctx || {}, H && H.code ? H.code() : ''); },
      fillForm() { return {}; },
      pure
    };
  }
  const pure = { frameOf, probeOf, runProbe, runPy, buildSketch, buildScript, liveRows, EMPTY };
  const mod = { pure, adapterFor };
  root.VerbundAdMcu = mod;
  root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {};
  ['code', 'pi'].forEach(l => { const a = adapterFor(l); root.VERBUND_ADAPTERS[l] = a; if (root.Verbund && typeof root.Verbund.registerAdapter === 'function') root.Verbund.registerAdapter(l, a); });
  if (typeof module === 'object' && module && module.exports) {
    module.exports = mod;
    try { const K = require('./verbund.js'); if (K && typeof K.registerAdapter === 'function') { root.Verbund = root.Verbund || K; ['code', 'pi'].forEach(l => K.registerAdapter(l, root.VERBUND_ADAPTERS[l])); } } catch (e) { /* Kern nicht vorhanden */ }
  }
})(typeof window !== 'undefined' ? window : globalThis);
