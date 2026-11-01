'use strict';
/* rigui-base.js (Schlank Stufe 4): Oberflaechen-Rahmen der Pruefstand-/Anlage-Labs. GENERIERT von quelle/gen/rigui/build_rigui.js, nicht von Hand aendern.
   Mechanik: Gruppen-Fabriken B[key] = { d: Abhaengigkeiten, f: Fabrik (liefert die Namen) }, map[lab] = { h, p, k }.
   pure(lab, C) baut Stufe 0 (Abhaengigkeiten nur root und Lab-Funktionen), kit(lab, C) Stufe 1; jede Abhaengigkeit muss vorhanden sein (kein stilles Global). */
(function (__rgRoot) {
  if (__rgRoot.RIGUI) return;
  const R = __rgRoot.RIGUI = { B: Object.create(null), map: Object.create(null), env: Object.create(null) };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  R.ok = (lab, h) => { const m = R.map[lab]; return !!m && m.h === h && m.p.concat(m.k).every(k => !!R.B[k]); };
  function run(lab, keys, E) {
    const late = [];
    for (const k of keys) {
      const b = R.B[k]; if (!b) throw new Error('RIGUI ' + lab + ': Block fehlt: ' + k);
      for (const d of b.d) if (!(d in E)) throw new Error('RIGUI ' + lab + ': Abhaengigkeit fehlt: ' + d + ' (' + k + ')');
      const r = b.f(E), out = r[0];
      for (const n of Object.keys(out)) { if (n in E) throw new Error('RIGUI ' + lab + ': Name doppelt: ' + n); E[n] = out[n]; }
      if (r[1]) late.push([k, b, r[1]]);
    }
    for (const [k, b, f] of late) { for (const d of b.l) if (!(d in E)) throw new Error('RIGUI ' + lab + ': Abhaengigkeit fehlt: ' + d + ' (' + k + ')'); f(E); }
  }
  function take(lab, C, E) { for (const k in C) { if (!has(C, k)) continue; if (k in E) throw new Error('RIGUI ' + lab + ': Name doppelt: ' + k); E[k] = C[k]; } }
  R.pure = (lab, C) => { const m = R.map[lab]; if (!m) throw new Error('RIGUI: Lab unbekannt: ' + lab); const E = R.env[lab] = Object.create(null); take(lab, C, E); run(lab, m.p, E); return E; };
  R.kit = (lab, C) => { const m = R.map[lab], E = R.env[lab]; if (!m || !E) throw new Error('RIGUI ' + lab + ': pure() fehlt'); take(lab, C, E); run(lab, m.k, E); return E; };
})(typeof window !== 'undefined' ? window : globalThis);
