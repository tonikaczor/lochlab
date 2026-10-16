'use strict';
/* Tonfunk HausLab: drei Häuser (Einfamilienhaus, Altbau-Wohnung, Bürokomplex), Übungshäuser und Aufgaben.
   Die Häuser werden mit einem kleinen Baukasten (B) beschrieben: Räume, Objekte mit Schlüssel (key), Leitungen. */
(function (root) {
  root.HAUS_DATA = function (api, HAUS) {
    const RES = api.RES, T = HAUS.TYPES;
    const COL = ['#3b4756', '#44503f', '#4d4458', '#3f5253', '#56493f', '#46525f', '#4f4a3a'];
    /* ---------------- Baukasten ---------------- */
    function B(name) {
      const h = HAUS.newHouse(name), b = { h };
      b.R = (n, x, y, w, d) => { const r = { id: HAUS.nid(h), n, x, y, w, d, c: COL[h.rooms.length % COL.length] }; h.rooms.push(r); return r; };
      b.O = (key, t, room, face, u, z, extra) => { const o = Object.assign({ id: HAUS.nid(h), key, t, room: room.id, face, u, z: z == null ? T[t].z : z, on: t === 'swi' || t === 'swc' ? 0 : 1 }, extra || {}); if (face === 'C') { o.v = o.v == null ? 1.5 : o.v; o.z = h.h; } if (t === 'lamp' && o.w == null) o.w = 60; h.objs.push(o); return o; };
      b.C = (a, bb, s, slot, extra) => { const c = Object.assign({ id: HAUS.nid(h), a: a.id, b: bb.id, s: s || 1.5 }, extra || {}); if (slot != null) c.slot = slot; h.cables.push(c); return c; };
      b.chain = (slot, list, s) => { const pan = h.objs.find(o => o.t === 'panel'); b.C(pan, list[0], s, slot); for (let i = 1; i < list.length; i++) b.C(list[i - 1], list[i], s); };
      b.fi = (n, type) => { h.panel.fi[n].type = type || '30mA'; };
      b.ls = (i, type, fi) => { h.panel.slots[i].ls = type; h.panel.slots[i].fi = fi || 0; };
      b.ls3 = (i, type, fi) => { h.panel.slots[i].ls = type; h.panel.slots[i].fi = fi || 0; h.panel.slots[i].p3 = 1; };
      b.ph = (i, p) => { h.panel.slots[i].ph = p; };
      b.chain3 = (slot, list, s) => { const pan = h.objs.find(o => o.t === 'panel'); b.C(pan, list[0], s, slot, { ph3: 1 }); for (let i = 1; i < list.length; i++) b.C(list[i - 1], list[i], s, null, { ph3: 1 }); };
      b.pair = (a, c) => { a.partner = c.id; c.partner = a.id; };
      return b;
    }
    const byKey = (h, k) => h.objs.find(o => o.key === k);
    const K = k => byKey(api.sch.haus, k);

    /* ---------------- Haus 1: Einfamilienhaus ---------------- */
    function haus1(stage) {
      const b = B('Einfamilienhaus'), W = b.R('Wohnzimmer', 0, 0, 5, 4.5), Ku = b.R('Küche', 5, 0, 3.5, 4.5), F = b.R('Flur', 0, 4.5, 3, 3.5), Ba = b.R('Bad', 3, 4.5, 2.5, 3.5), S = b.R('Schlafzimmer', 5.5, 4.5, 3, 3.5), Ga = b.R('Garage', 0, 8, 3, 3.5);
      const pan = b.O('pan', 'panel', F, 'N', 1.5, 1.5);
      const swF = b.O('swF', 'swi', F, 'S', 0.8), lF = b.O('lF', 'lamp', F, 'C', 1.5, null, { v: 1.75 }), sF = b.O('sF', 'sock', F, 'W', 2.5, 0.3);
      const lW = b.O('lW', 'lamp', W, 'C', 2.5, null, { v: 2.25 }), cw1 = b.O('cw1', 'swc', W, 'N', 0.8), cw2 = b.O('cw2', 'swc', W, 'E', 1.5), s1 = b.O('sW1', 'sock', W, 'S', 1.0), s2 = b.O('sW2', 'sock', W, 'S', 2.5), sTV = b.O('sTV', 'sock', W, 'S', 4.0, 0.3, { w: 120, n: 'Fernseher' });
      const j1 = b.O('j1', 'junc', W, 'E', 3.5), j2 = b.O('j2', 'junc', W, 'E', 3.9), jL = b.O('jL', 'junc', F, 'E', 1.0), jW = b.O('jW', 'junc', W, 'S', 4.6), jB = b.O('jB', 'junc', Ba, 'E', 2.8);
      const lK = b.O('lK', 'lamp', Ku, 'C', 1.75, null, { v: 2.25 }), swK = b.O('swK', 'swi', Ku, 'W', 3.5), k1 = b.O('sK1', 'sock', Ku, 'S', 0.8, 1.05), k2 = b.O('sK2', 'sock', Ku, 'S', 1.8, 1.05), k3 = b.O('sK3', 'sock', Ku, 'S', 2.8, 1.05, { w: 2000, n: 'Wasserkocher' }), kk = b.O('sKue', 'sock', Ku, 'E', 0.8, 0.3, { w: 150, n: 'Kühlschrank' }), ofen = b.O('ofen', 'dev3', Ku, 'E', 2.5, 0.9, { w: 7000, n: 'Herd' });
      const lGa = b.O('lGa', 'lamp', Ga, 'C', 1.5, null, { v: 1.75 }), swGa = b.O('swGa', 'swi', Ga, 'S', 1.0), wb = b.O('wb', 'dev3', Ga, 'W', 1.5, 1.2, { w: 11000, n: 'Wallbox' }), cee = b.O('cee', 'sock3', Ga, 'E', 1.5, 0.3, { w: 4000, n: 'Kompressor' });
      const lB = b.O('lB', 'lamp', Ba, 'C', 1.25, null, { v: 1.75 }), swB = b.O('swB', 'swi', Ba, 'W', 1.0), sB = b.O('sB', 'sock', Ba, 'E', 1.5, 1.2);
      const lS = b.O('lS', 'lamp', S, 'C', 1.5, null, { v: 1.75 }), swS = b.O('swS', 'swi', S, 'W', 1.0), t1 = b.O('sS1', 'sock', S, 'E', 1.0), t2 = b.O('sS2', 'sock', S, 'N', 1.5);
      if (stage !== 'roh') {
        b.fi(0, '30mA'); [0, 1, 2, 4].forEach(i => b.ls(i, i === 0 ? 'B10' : 'B16', 1)); b.ph(0, 1); b.ph(1, 2); b.ph(2, 3); b.ph(4, 1); b.ls3(3, 'B16', 1); b.ls3(5, 'B20', 1); b.ls3(6, 'B16', 1);
        b.C(pan, jL, 1.5, 0); b.C(jL, swF); b.C(swF, lF); b.C(jL, cw1); b.C(cw1, cw2); b.pair(cw1, cw2); b.C(cw2, lW); b.C(jL, jW); b.C(jW, swK); b.C(swK, lK); b.C(jL, swB); b.C(swB, lB); b.C(jL, jB); b.C(jB, swS); b.C(swS, lS); b.C(jL, swGa); b.C(swGa, lGa);
        b.chain(1, [sF, s1, s2, sTV], 2.5); b.chain(2, [j1, k1, k2, k3, kk], 2.5); b.chain3(3, [j2, ofen], 2.5); b.chain(4, [sB, t1, t2], 2.5); b.chain3(5, [wb], 4); b.chain3(6, [cee], 2.5);
      }
      return b.h;
    }
    /* ---------------- Haus 2: Altbau-Wohnung ---------------- */
    function haus2(stage) {
      const b = B('Altbau-Wohnung'), D = b.R('Diele', 0, 0, 2.5, 7.5), W = b.R('Wohnzimmer', 2.5, 0, 4.5, 4.5), Ku = b.R('Küche', 7, 0, 3, 4.5), Ba = b.R('Bad', 2.5, 4.5, 2.5, 3), Ki = b.R('Kinderzimmer', 5, 4.5, 3, 3), S = b.R('Schlafzimmer', 8, 4.5, 2.5, 3);
      const pan = b.O('pan', 'panel', D, 'W', 2.0, 1.5);
      const jD = b.O('jD', 'junc', D, 'E', 3.0), jW2 = b.O('jW2', 'junc', W, 'W', 3.5), jKi = b.O('jKi', 'junc', Ki, 'N', 1.2), lD = b.O('lD', 'lamp', D, 'C', 1.25, null, { v: 3.5 }), swD = b.O('swD', 'swi', D, 'S', 1.0), sD = b.O('sD', 'sock', D, 'E', 6.5);
      const lW = b.O('lW', 'lamp', W, 'C', 2.25, null, { v: 2.25 }), swW = b.O('swW', 'swi', W, 'W', 1.0), w1 = b.O('sW1', 'sock', W, 'S', 1.0), w2 = b.O('sW2', 'sock', W, 'S', 3.0), w3 = b.O('sW3', 'sock', W, 'N', 2.0);
      const lK = b.O('lK', 'lamp', Ku, 'C', 1.5, null, { v: 2.25 }), swK = b.O('swK', 'swi', Ku, 'W', 3.5), k1 = b.O('sK1', 'sock', Ku, 'S', 1.0, 1.05, { w: 2000, n: 'Wasserkocher', on: 0 }), k2 = b.O('sK2', 'sock', Ku, 'S', 2.0, 1.05), herd = b.O('herd', 'dev', Ku, 'E', 2.5, 0.9, { w: 3500, n: 'Backofen', on: 0 });
      const lB = b.O('lB', 'lamp', Ba, 'C', 1.25, null, { v: 1.5 }), swB = b.O('swB', 'swi', Ba, 'N', 0.8), sB = b.O('sB', 'sock', Ba, 'E', 1.5, 1.2, { w: 2200, n: 'Waschmaschine', on: 0 });
      const lKi = b.O('lKi', 'lamp', Ki, 'C', 1.5, null, { v: 1.5 }), swKi = b.O('swKi', 'swi', Ki, 'W', 1.0), ki1 = b.O('sKi1', 'sock', Ki, 'S', 1.0), ki2 = b.O('sKi2', 'sock', Ki, 'E', 1.5);
      const lS = b.O('lS', 'lamp', S, 'C', 1.25, null, { v: 1.5 }), swS = b.O('swS', 'swi', S, 'W', 1.0), sc1 = b.O('sS1', 'sock', S, 'E', 1.0), sc2 = b.O('sS2', 'sock', S, 'N', 1.2);
      if (stage === 'bestand') {
        b.ls(0, 'B16'); b.ls(1, 'B16');       // Bestand: kein FI, überall 1,5 mm²
        b.C(pan, jD, 1.5, 0); b.C(jD, swD); b.C(swD, lD); b.C(jD, swB); b.C(swB, lB); b.C(jD, jW2); b.C(jW2, swW); b.C(swW, lW); b.C(jW2, swK); b.C(swK, lK); b.C(jW2, swKi); b.C(swKi, lKi); b.C(jW2, jKi); b.C(jKi, swS); b.C(swS, lS);
        b.chain(1, [sD, w1, w2, w3], 1.5); b.C(w3, k1, 1.5); b.C(k1, k2, 1.5); b.C(k2, herd, 1.5); b.C(sD, sB, 1.5); b.C(sB, ki1, 1.5); b.C(ki1, ki2, 1.5); b.C(ki2, sc1, 1.5); b.C(sc1, sc2, 1.5);
      }
      return b.h;
    }
    /* ---------------- Haus 3: Bürokomplex ---------------- */
    function haus3(stage) {
      const b = B('Bürokomplex'), G = b.R('Großraumbüro', 0, 0, 8, 6), B1 = b.R('Büro 1', 8, 0, 4, 3), B2 = b.R('Büro 2', 8, 3, 4, 3), Bs = b.R('Besprechung', 12, 0, 4, 6), Sv = b.R('Serverraum', 0, 6, 4, 3), Tk = b.R('Teeküche', 4, 6, 4, 3), Fl = b.R('Flur', 8, 6, 11, 3), Tn = b.R('Technikraum', 16, 0, 3, 6);
      const pan = b.O('pan', 'panel', Fl, 'N', 1.5, 1.5);
      const lG1 = b.O('lG1', 'lamp', G, 'C', 2, null, { v: 2, w: 40 }), lG2 = b.O('lG2', 'lamp', G, 'C', 6, null, { v: 2, w: 40 }), lG3 = b.O('lG3', 'lamp', G, 'C', 2, null, { v: 4.5, w: 40 }), lG4 = b.O('lG4', 'lamp', G, 'C', 6, null, { v: 4.5, w: 40 }), swG = b.O('swG', 'swi', G, 'E', 5.5);
      const lB1 = b.O('lB1', 'lamp', B1, 'C', 2, null, { v: 1.5, w: 40 }), swB1 = b.O('swB1', 'swi', B1, 'S', 0.8), lB2 = b.O('lB2', 'lamp', B2, 'C', 2, null, { v: 1.5, w: 40 }), swB2 = b.O('swB2', 'swi', B2, 'N', 0.8), lBs = b.O('lBs', 'lamp', Bs, 'C', 2, null, { v: 3, w: 60 }), swBs = b.O('swBs', 'swi', Bs, 'W', 4.5), lF = b.O('lF', 'lamp', Fl, 'C', 4, null, { v: 1.5, w: 40 }), swF = b.O('swF', 'swi', Fl, 'N', 6.5);
      const pcs = []; ['S', 'N'].forEach((f, fi) => [1, 2.5, 4, 5.5].forEach((u, i) => pcs.push(b.O('pcG' + fi + i, 'sock', G, f, u, 1.05, { w: 300, n: 'PC-Arbeitsplatz' }))));
      const pcB1 = b.O('pcB1', 'sock', B1, 'N', 2, 1.05, { w: 300, n: 'PC-Arbeitsplatz' }), pcB2 = b.O('pcB2', 'sock', B2, 'S', 2, 1.05, { w: 300, n: 'PC-Arbeitsplatz' }), heiz = b.O('heizB2', 'sock', B2, 'E', 1.5, 0.3, { w: 2000, n: 'Heizlüfter' }), beamer = b.O('beamer', 'sock', Bs, 'E', 3, 1.05, { w: 350, n: 'Beamer' });
      const srv = b.O('server', 'sock', Sv, 'W', 1.5, 1.05, { w: 1500, n: 'Server' }), srv2 = b.O('server2', 'sock', Sv, 'S', 1.5, 1.05, { w: 1500, n: 'Server' });
      const wk = b.O('wk', 'sock', Tk, 'S', 1, 1.05, { w: 2000, n: 'Wasserkocher' }), kaf = b.O('kaf', 'sock', Tk, 'S', 2.2, 1.05, { w: 1000, n: 'Kaffeemaschine' }), kue = b.O('kue', 'sock', Tk, 'E', 1.2, 0.3, { w: 150, n: 'Kühlschrank' });
      const lS1 = b.O('lSv', 'lamp', Sv, 'C', 2, null, { v: 1.5, w: 40 }), swSv = b.O('swSv', 'swi', Sv, 'N', 3), lTk = b.O('lTk', 'lamp', Tk, 'C', 2, null, { v: 1.5, w: 40 }), swTk = b.O('swTk', 'swi', Tk, 'W', 2);
      const klima = b.O('klima', 'dev3', Tn, 'E', 1.5, 1.2, { w: 8000, n: 'Klimagerät' }), lueft = b.O('lueft', 'dev3', Tn, 'E', 4.5, 1.2, { w: 3000, n: 'Lüftung (Motor)', motor: 1 }), ceeT = b.O('ceeT', 'sock3', Tn, 'S', 1.5, 0.3, { w: 4000, n: 'Kompressor' });
      const jG = b.O('jG', 'junc', G, 'S', 6.5, 2.2), jF = b.O('jF', 'junc', Fl, 'N', 0.6, 2.2), jTk = b.O('jTk', 'junc', Tk, 'N', 3, 2.2), jT2 = b.O('jT2', 'junc', Tk, 'N', 1.2, 2.2), jT3 = b.O('jT3', 'junc', Tk, 'N', 2.0, 2.2), jB2 = b.O('jB2', 'junc', B2, 'S', 3.2, 2.2);
      if (stage !== 'roh') {
        b.fi(0, '30mA'); b.fi(1, '30mA'); b.ls(0, 'B10', 0); b.ls(1, 'B10', 0); b.ls(2, 'B16', 1); b.ls(3, 'B16', 1); b.ls(4, 'B16', 1); b.ls(5, 'B16', 2); b.ls3(6, 'B16', 2); b.ls3(7, 'C16', 2); b.ph(0, 1); b.ph(1, 2); b.ph(2, 3); b.ph(3, 1); b.ph(4, 2); b.ph(5, 3);
        b.C(pan, jF, 1.5, 0); b.C(jF, swF); b.C(swF, lF); b.C(jF, swBs); b.C(swBs, lBs); b.C(jF, jB2); b.C(jB2, swB2); b.C(swB2, lB2); b.C(jB2, swB1); b.C(swB1, lB1);
        b.C(pan, jTk, 1.5, 1); b.C(jTk, swTk); b.C(swTk, lTk); b.C(jTk, swSv); b.C(swSv, lS1); b.C(jTk, jG); b.C(jG, swG); b.C(swG, lG1); b.C(lG1, lG2); b.C(lG2, lG4); b.C(lG4, lG3);
        b.chain(2, [jT2, pcs[0], pcs[1], pcs[2], pcs[3]], 2.5); b.C(pcs[3], pcs[7], 2.5); b.C(pcs[7], pcs[6], 2.5); b.C(pcs[6], pcs[5], 2.5); b.C(pcs[5], pcs[4], 2.5);
        b.chain(3, [pcB2, heiz], 2.5); b.C(pcB2, pcB1, 2.5); b.C(pcB1, beamer, 2.5);
        b.chain(4, [kue, wk, kaf], 2.5);
        b.chain(5, [jT3, srv, srv2], 2.5); b.chain3(6, [klima], 2.5); b.chain3(7, [lueft, ceeT], 2.5);
      }
      return b.h;
    }
    const leer = () => B('Eigenes Haus').h;

    /* ---------------- Beispiele ---------------- */
    const EX = [
      ['Häuser', 'Einfamilienhaus (fertig installiert)', 'Sechs Räume, sieben Stromkreise mit 4-poligem FI: Licht mit Wechselschaltung, Steckdosen auf drei Phasen, Drehstrom-Herd, Wallbox und CEE-Steckdose in der Garage. Auf „Sim“ stellen und alles ausprobieren.', () => haus1('fertig')],
      ['Häuser', 'Altbau-Wohnung (Bestand ohne FI)', 'Zwei Stromkreise, nur 1,5 mm², kein FI: So war es früher. Schalte um und prüfe, was ein Körperschluss anrichtet.', () => haus2('bestand')],
      ['Häuser', 'Bürokomplex (fertig installiert)', 'Acht Räume, acht PC-Arbeitsplätze, Server, Teeküche und Technikraum mit Klimagerät, Lüftung und Kompressor (Drehstrom), zwei FI-Schutzschalter und acht Stromkreise.', () => haus3('fertig')],
      ['Rohbau zum Installieren', 'Einfamilienhaus (Rohbau)', 'Alle Geräte sind gesetzt, es fehlen Verteiler und Leitungen. Bestücke den Verteilerkasten und ziehe die Leitungen.', () => haus1('roh')],
      ['Rohbau zum Installieren', 'Altbau-Wohnung (Rohbau)', 'Die Wohnung ist leer installiert. Plane die Stromkreise neu: mit FI und 2,5 mm² für die Steckdosen.', () => haus2('roh')],
      ['Rohbau zum Installieren', 'Bürokomplex (Rohbau)', 'Viele Geräte, ein leerer Verteiler: Verteile die Last auf mehrere Stromkreise und zwei FI.', () => haus3('roh')],
      ['Frei gestalten', 'Leeres Grundstück', 'Zeichne eigene Räume, setze Geräte und installiere dein Haus von Grund auf.', () => leer()]
    ];
    api.addExamples(EX.map(([cat, name, info, mk]) => ({ lab: 'haus', cat, name, info, make: () => ({ parts: [], wires: [], haus: mk() }) })));

    /* ---------------- Prüf-Bausteine ---------------- */
    const get = () => api.sch.haus;
    const lines = {
      cabled: (a, text, k) => RES(a, text),
    };
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const lsAmp = ls => parseFloat(String(ls || '').replace(/[^0-9.]/g, '')) || 0;
    const ev = (h, o) => HAUS.evalHouse(h, o);
    const withOn = (h, sets) => { const c = JSON.parse(JSON.stringify(h)); sets.forEach(([key, v]) => { const o = byKey(c, key); if (o) o.on = v; }); return c; };
    const cabCount = h => h.cables.length;
    const powerText = (h, r) => { const bad = h.objs.filter(o => o.t !== 'panel' && o.t !== 'junc' && o.t !== 'swi' && o.t !== 'swc' && !(r.v[o.id] > 200)); return bad; };
    const allPowered = (h, keys, r) => { const bad = keys.filter(k => { const o = byKey(h, k); return !o || !(r.v[o.id] > 280); }); return bad; };
    const slotOk = h => { const cur = HAUS.slotLoads(h), bad = []; Object.keys(cur).forEach(s => { const ls = lsAmp(h.panel.slots[s].ls); if (cur[s] > ls + 1e-9) bad.push((+s + 1) + ' (' + cur[s].toFixed(1) + ' A auf ' + h.panel.slots[s].ls + ')'); }); return bad; };
    const secOk = (h, keys, min) => { const bad = []; h.cables.forEach(c => { const a = h.objs.find(o => o.id === c.a), b = h.objs.find(o => o.id === c.b); if (keys.some(k => (a && a.key === k) || (b && b.key === k)) && c.s < min) bad.push(c); }); return bad; };
    const fiBehind = (h) => { const P = h.panel, bad = []; h.cables.forEach(c => { if (c.slot == null) return; const s = P.slots[c.slot]; if (!s || !s.ls) return; const hasFi = s.fi > 0 && P.fi[s.fi - 1].type === '30mA'; if (!hasFi) bad.push(c.slot + 1); }); return [...new Set(bad)]; };

    /* Aufgaben-Häuser */
    const flurHaus = (sol) => {
      const b = B('Flur'), F = b.R('Flur', 0, 0, 4, 3), pan = b.O('pan', 'panel', F, 'N', 1.0, 1.5), sw = b.O('sw', 'swi', F, 'S', 1.0), l = b.O('l', 'lamp', F, 'C', 2, null, { v: 1.5 });
      b.fi(0); b.ls(0, 'B10', 1); if (sol) { b.C(pan, sw, 1.5, 0); b.C(sw, l); } return b.h;
    };
    const kuecheHaus = (sol, thin) => {
      const b = B('Küche'), K0 = b.R('Küche', 0, 0, 5, 3.5), pan = b.O('pan', 'panel', K0, 'N', 0.8, 1.5), s1 = b.O('s1', 'sock', K0, 'S', 1, 1.05), s2 = b.O('s2', 'sock', K0, 'S', 2.2, 1.05), s3 = b.O('s3', 'sock', K0, 'S', 3.4, 1.05, { w: 2000, n: 'Wasserkocher' });
      b.fi(0); b.ls(0, 'B16', 1); if (sol || thin) b.chain(0, [s1, s2, s3], thin ? 1.5 : 2.5); return b.h;
    };
    const wechselHaus = (sol) => {
      const b = B('Flur mit Wechselschaltung'), F = b.R('Flur', 0, 0, 6, 3), pan = b.O('pan', 'panel', F, 'N', 3, 1.5), a = b.O('cwA', 'swc', F, 'S', 0.8), c = b.O('cwB', 'swc', F, 'S', 5.2), l = b.O('l', 'lamp', F, 'C', 3, null, { v: 1.5 });
      b.fi(0); b.ls(0, 'B10', 1); if (sol) { b.C(pan, a, 1.5, 0); b.C(a, c); b.pair(a, c); b.C(c, l); } return b.h;
    };
    const verteilerHaus = () => { const h = haus1('roh'); return h; };
    const bestandHaus = (sol) => {
      const h = haus2('bestand'); if (sol) { h.panel.fi[0].type = '30mA'; h.panel.slots.forEach(s => { if (s.ls) s.fi = 1; }); } return h;
    };
    const dickeHaus = (sol) => { const h = kuecheHaus(false, true); if (sol) h.cables.forEach(c => { c.s = 2.5; }); return h; };
    const fehlerHaus = (bad) => { const h = haus1('fertig'); if (bad) { const sw = byKey(h, 'swK'), lk = byKey(h, 'lK'); const c = h.cables.find(c => (c.a === sw.id && c.b === lk.id) || (c.a === lk.id && c.b === sw.id)); c.bad = 1; sw.on = 1; } else { byKey(h, 'swK').on = 1; } return h; };
    const koerperHaus = (sol) => { const h = haus1('fertig'); const t = byKey(h, 'sW2'); t.f = sol ? 0 : 1; t.n = 'Defekte Stehlampe'; t.w = 60; return h; };
    const lastHaus = (sol) => {
      const b = B('Küchenzeile'), K0 = b.R('Küche', 0, 0, 6, 3.5), pan = b.O('pan', 'panel', K0, 'N', 0.8, 1.5), o = b.O('ofen', 'dev', K0, 'S', 1.0, 0.9, { w: 3500, n: 'Backofen' }), wk = b.O('wk', 'sock', K0, 'S', 2.5, 1.05, { w: 2000, n: 'Wasserkocher' }), kf = b.O('kf', 'sock', K0, 'S', 3.6, 1.05, { w: 1000, n: 'Kaffeemaschine' }), ki = b.O('ki', 'sock', K0, 'S', 4.7, 0.3, { w: 150, n: 'Kühlschrank' });
      b.fi(0); b.ls(0, 'B16', 1); b.ls(1, 'B16', 1); b.ls(2, 'B16', 1);
      if (sol) { b.C(pan, o, 2.5, 0); b.chain(1, [wk, kf, ki], 2.5); } else { b.chain(0, [o, wk, kf, ki], 2.5); } return b.h;
    };
    const bueroHaus = (sol) => {
      const h = haus3('roh'); if (sol) { const pcs = h.objs.filter(o => /^pcG/.test(o.key)), pan = h.objs.find(o => o.t === 'panel'); const b = { h }; h.panel.fi[0].type = '30mA'; [0, 1, 2].forEach(i => { h.panel.slots[i].ls = 'B16'; h.panel.slots[i].fi = 1; });
        const C = (a, c, s, slot) => { const x = { id: HAUS.nid(h), a: a.id, b: c.id, s }; if (slot != null) x.slot = slot; h.cables.push(x); };
        const jA = byKey(h, 'jT2'), jB = byKey(h, 'jT3'); C(pan, jA, 2.5, 0); C(jA, pcs[0], 2.5); for (let i = 1; i < 4; i++) C(pcs[i - 1], pcs[i], 2.5); C(pan, jB, 2.5, 1); C(jB, pcs[4], 2.5); for (let i = 5; i < 8; i++) C(pcs[i - 1], pcs[i], 2.5);
        const hz = byKey(h, 'heizB2'), p2 = byKey(h, 'pcB2'), p1 = byKey(h, 'pcB1'), bm = byKey(h, 'beamer'); C(pan, hz, 2.5, 2); C(hz, p2, 2.5); C(p2, p1, 2.5); C(p1, bm, 2.5);
      } return h;
    };
    const serverHaus = (sol) => {
      const b = B('Serverraum'), S0 = b.R('Serverraum', 0, 0, 4, 3), T0 = b.R('Teeküche', 4, 0, 4, 3), pan = b.O('pan', 'panel', T0, 'N', 2, 1.5), srv = b.O('server', 'sock', S0, 'W', 1.5, 1.05, { w: 1500, n: 'Server' }), wk = b.O('wk', 'sock', T0, 'S', 1.5, 1.05, { w: 2000, n: 'Wasserkocher' });
      b.fi(0); b.fi(1); b.ls(0, 'B16', 1); b.ls(1, 'B16', 1); if (sol) { b.C(pan, srv, 2.5, 0); b.C(pan, wk, 2.5, 1); } else { b.C(pan, wk, 2.5, 0); b.C(wk, srv, 2.5); } return b.h;
    };
    const zwischenHaus = (sol) => {
      const b = B('Drei Räume'), A = b.R('Raum A', 0, 0, 3.5, 3), M = b.R('Mittelraum', 3.5, 0, 3.5, 3), Z = b.R('Raum B', 7, 0, 3.5, 3), pan = b.O('pan', 'panel', A, 'N', 1.5, 1.5), sw = b.O('sw', 'swi', A, 'S', 1), l = b.O('l', 'lamp', Z, 'C', 1.75, null, { v: 1.5 }), j = b.O('j', 'junc', M, 'S', 1.75, 2.2);
      b.fi(0); b.ls(0, 'B10', 1); if (sol) { b.C(pan, sw, 1.5, 0); b.C(sw, j); b.C(j, l); } return b.h;
    };
    const freiHaus = () => leer();
    const herdHaus = (sol) => { const b = B('Küche mit Herd'), K0 = b.R('Küche', 0, 0, 5, 3.5), pan = b.O('pan', 'panel', K0, 'N', 0.8, 1.5), herd = b.O('herd', 'dev3', K0, 'S', 2, 0.9, { w: 7000, n: 'Herd' }); b.fi(0); b.ls3(0, 'B16', 1); if (sol) b.C(pan, herd, 2.5, 0, { ph3: 1 }); return b.h; };
    const grossHaus = (sol) => { const b = B('Technikraum'), T0 = b.R('Technikraum', 0, 0, 5, 4), pan = b.O('pan', 'panel', T0, 'N', 1, 1.5), wb = b.O('wb', 'dev3', T0, 'S', 1.5, 1.2, { w: 11000, n: 'Wallbox' }), dl = b.O('dl', 'dev3', T0, 'S', 3.5, 1.2, { w: 18000, n: 'Durchlauferhitzer' }); b.fi(0); if (sol) { b.ls3(0, 'B16', 1); b.ls3(1, 'B32', 1); b.C(pan, wb, 2.5, 0, { ph3: 1 }); b.C(pan, dl, 6, 1, { ph3: 1 }); } return b.h; };
    const PHL = [3000, 3000, 2000, 1000, 1000, 2000];
    const phaseHaus = (sol) => { const b = B('Werkstatt'), W0 = b.R('Werkstatt', 0, 0, 8, 4), pan = b.O('pan', 'panel', W0, 'N', 1, 1.5); b.fi(0); PHL.forEach((w, i) => { const s = b.O('m' + i, 'sock', W0, 'S', 0.8 + i * 1.2, 1.05, { w, n: 'Maschine ' + (i + 1) }); b.ls(i, 'B16', 1); b.ph(i, sol ? [1, 2, 3, 1, 2, 3][i] : 1); b.C(pan, s, 2.5, i); }); return b.h; };
    const fiHerdHaus = (sol) => { const h = herdHaus(true); h.panel.slots[0].fi = sol ? 1 : 0; return h; };

    /* ---------------- Aufgaben ---------------- */
    const mkT = t => Object.assign({ lab: 'haus' }, t);
    const solH = f => () => ({ parts: [], wires: [], haus: f() });
    const TASKS = [
      mkT({ id: 'ha1', cat: 'Licht', title: 'Ausschaltung: Lampe schalten', level: 1, text: 'Im Flur sind Verteilerkasten, Lichtschalter und Lampe gesetzt. Der Verteiler hat schon FI und Automat. Ziehe die Leitungen: Verteiler → Schalter → Lampe. Die Lampe soll mit dem Schalter an und aus gehen.',
        hint: 'Wähle „Leitung“, tippe den Verteilerkasten an und dann den Schalter (Abgang 1 wählen). Danach vom Schalter zur Lampe. Die Leitung läuft von selbst an Wänden und Decke. In „Sim“ tippst du den Schalter an.',
        start: solH(() => flurHaus(false)), solMake: solH(() => flurHaus(true)),
        check() { const h = get(), sw = K('sw'), l = K('l'), L = []; L.push(RES(h.cables.length >= 2, h.cables.length >= 2 ? 'Zwei Leitungen gezogen' : 'Es fehlen Leitungen (Verteiler → Schalter → Lampe)')); const off = ev(withOn(h, [['sw', 0]])), on = ev(withOn(h, [['sw', 1]])); L.push(RES(!!on.lit[l.id], on.lit[l.id] ? 'Bei eingeschaltetem Schalter leuchtet die Lampe' : 'Bei eingeschaltetem Schalter bleibt die Lampe dunkel')); L.push(RES(!off.lit[l.id] && !!on.lit[l.id], !off.lit[l.id] && on.lit[l.id] ? 'Bei ausgeschaltetem Schalter ist die Lampe aus' : 'Der Schalter schaltet die Lampe noch nicht')); return L; } }),
      mkT({ id: 'ha2', cat: 'Steckdosen', title: 'Steckdosen in der Küche reihen', level: 1, text: 'In der Küche sitzen drei Steckdosen (an einer hängt ein Wasserkocher). Ziehe eine Leitung vom Verteiler zur ersten Steckdose und von dort weiter zur zweiten und dritten. Für Steckdosen nimmst du 2,5 mm².',
        hint: 'Leitung → Verteiler → erste Steckdose (Abgang 1). Dann erste → zweite → dritte Steckdose. Tippe danach eine Leitung an und stelle den Querschnitt auf 2,5 mm².',
        start: solH(() => kuecheHaus(false, false)), solMake: solH(() => kuecheHaus(true, false)),
        check() { const h = get(), r = ev(h), L = []; ['s1', 's2', 's3'].forEach((k, i) => { const o = K(k); L.push(RES(!!o && r.v[o.id] > 280, o && r.v[o.id] > 280 ? 'Steckdose ' + (i + 1) + ' hat Spannung' : 'Steckdose ' + (i + 1) + ' hat keine Spannung')); }); const thin = secOk(h, ['s1', 's2', 's3'], 2.5); L.push(RES(h.cables.length >= 3 && !thin.length, !thin.length && h.cables.length >= 3 ? 'Alle Leitungen haben 2,5 mm²' : 'Steckdosenleitungen brauchen mindestens 2,5 mm²')); L.push(RES(!r.trip.length, !r.trip.length ? 'Nichts löst aus' : 'Ein Schutzschalter löst aus: ' + r.trip[0])); return L; } }),
      mkT({ id: 'ha3', cat: 'Verteiler', title: 'Verteilerkasten bestücken', level: 1, text: 'Das Einfamilienhaus ist im Rohbau: Geräte stehen, der Verteilerkasten ist leer. Öffne ihn (Knopf „Verteiler“) und setze einen FI 30 mA sowie fünf Automaten ein: einen B10 für das Licht und vier B16 für Steckdosen und Küche. Hänge alle Automaten hinter den FI.',
        hint: 'Tippe auf leere Plätze mit „＋“. Für den FI links: „FI 30 mA“. Bei jedem Automaten wählst du darunter „hinter FI 1“.',
        start: solH(() => haus1('roh')), solMake: solH(() => { const h = haus1('roh'); h.panel.fi[0].type = '30mA'; [0, 1, 2, 3, 4].forEach(i => { h.panel.slots[i].ls = i === 0 ? 'B10' : 'B16'; h.panel.slots[i].fi = 1; }); return h; }),
        check() { const P = get().panel, L = [], ls = P.slots.filter(s => s.ls); L.push(RES(P.fi[0].type === '30mA' || P.fi[1].type === '30mA', P.fi[0].type === '30mA' || P.fi[1].type === '30mA' ? 'FI 30 mA eingesetzt' : 'Es fehlt ein FI 30 mA')); L.push(RES(ls.length >= 5, ls.length >= 5 ? 'Fünf Automaten eingesetzt' : 'Es fehlen Automaten (' + ls.length + ' von 5)')); L.push(RES(ls.some(s => s.ls === 'B10'), ls.some(s => s.ls === 'B10') ? 'Ein B10 für das Licht ist da' : 'Das Licht braucht einen B10')); L.push(RES(ls.filter(s => lsAmp(s.ls) >= 16).length >= 4, ls.filter(s => lsAmp(s.ls) >= 16).length >= 4 ? 'Vier Automaten mit 16 A für Steckdosen' : 'Es fehlen vier Automaten mit mindestens 16 A')); L.push(RES(ls.every(s => s.fi > 0), ls.length && ls.every(s => s.fi > 0) ? 'Alle Automaten hängen hinter dem FI' : 'Nicht jeder Automat hängt hinter dem FI')); return L; } }),
      mkT({ id: 'ha4', cat: 'Licht', title: 'Wechselschaltung im Flur', level: 3, text: 'Die Flurlampe soll von zwei Orten schaltbar sein. Verdrahte Verteiler → Wechselschalter A → Wechselschalter B → Lampe. Die Leitung zwischen den Wechselschaltern trägt die zwei Wechseldrähte.',
        hint: 'Leitung vom Verteiler zu Wechselschalter A (Abgang 1), von A zu B (das ist die Wechselleitung), von B zur Lampe. Probiere in „Sim“ aus: Jeder der beiden Schalter schaltet das Licht um.',
        start: solH(() => wechselHaus(false)), solMake: solH(() => wechselHaus(true)),
        check() { const h = get(), l = K('l'), L = [], st = (a, b) => ev(withOn(h, [['cwA', a], ['cwB', b]])).lit[l.id] || false; L.push(RES(h.cables.length >= 3, h.cables.length >= 3 ? 'Drei Leitungen gezogen' : 'Es fehlen Leitungen')); const a = st(0, 0), b = st(1, 0), c = st(0, 1), d = st(1, 1); L.push(RES(a !== b, a !== b ? 'Schalter A schaltet das Licht um' : 'Schalter A schaltet das Licht noch nicht um')); L.push(RES(a !== c, a !== c ? 'Schalter B schaltet das Licht um' : 'Schalter B schaltet das Licht noch nicht um')); L.push(RES(d === a, d === a ? 'Beide Schalter umgelegt: wie am Anfang' : 'Die Wechselschaltung arbeitet nicht richtig')); return L; } }),
      mkT({ id: 'ha5', cat: 'Verteiler', title: 'Küche: Last auf Stromkreise verteilen', level: 2, text: 'Backofen (3,5 kW), Wasserkocher (2 kW), Kaffeemaschine (1 kW) und Kühlschrank hängen alle an einem Abgang mit B16: Das ist zu viel (29 A). Verdrahte so um, dass kein Automat überlastet ist. Der Verteiler hat drei Abgänge.',
        hint: 'Rechne: Strom = Leistung durch 230 V. Der Backofen zieht gut 15 A und bekommt am besten einen eigenen Abgang. Lösche die Leitung vom Backofen zum Wasserkocher und ziehe eine neue vom Verteiler (anderer Abgang).',
        start: solH(() => lastHaus(false)), solMake: solH(() => lastHaus(true)),
        check() { const h = get(), r = ev(h), L = [], bad = slotOk(h); L.push(RES(!bad.length, !bad.length ? 'Kein Automat ist überlastet' : 'Überlastet: Abgang ' + bad[0])); ['ofen', 'wk', 'kf', 'ki'].forEach(k => { const o = K(k); L.push(RES(!!o && r.v[o.id] > 280, o && r.v[o.id] > 280 ? (o.n || 'Gerät') + ' läuft' : (o ? (o.n || 'Gerät') : 'Gerät') + ' hat keinen Strom')); }); L.push(RES(h.cables.filter(c => c.slot != null).length >= 2, h.cables.filter(c => c.slot != null).length >= 2 ? 'Mindestens zwei Abgänge belegt' : 'Du brauchst mindestens zwei Abgänge')); return L; } }),
      mkT({ id: 'ha6', cat: 'Schutz', title: 'Altbau: FI nachrüsten', level: 2, text: 'Die Altbauwohnung hat keinen FI. Rüste einen FI 30 mA nach und hänge beide Stromkreise dahinter. Prüfe in „Sim“: Ein Körperschluss am Gerät muss den FI auslösen.',
        hint: 'Verteiler öffnen, FI 1 mit „FI 30 mA“ bestücken, bei beiden Automaten „hinter FI 1“ wählen. In „Sim“ kannst du bei einer Steckdose „Körperschluss“ einschalten.',
        start: solH(() => bestandHaus(false)), solMake: solH(() => bestandHaus(true)),
        check() { const h = get(), L = [], P = h.panel; L.push(RES(P.fi.some(f => f.type === '30mA'), P.fi.some(f => f.type === '30mA') ? 'FI 30 mA eingesetzt' : 'Es fehlt ein FI 30 mA')); const miss = fiBehind(h); L.push(RES(!miss.length && P.fi.some(f => f.type === '30mA'), !miss.length ? 'Alle Stromkreise liegen hinter dem FI' : 'Abgang ' + miss[0] + ' liegt nicht hinter dem FI')); const c = JSON.parse(JSON.stringify(h)); const so = byKey(c, 'sW1'); so.f = 1; const r = ev(c); L.push(RES(r.trip.some(t => /FI/.test(t)), r.trip.some(t => /FI/.test(t)) ? 'Bei Körperschluss löst der FI aus' : 'Bei Körperschluss löst kein FI aus')); return L; } }),
      mkT({ id: 'ha7', cat: 'Steckdosen', title: 'Leitung zu dünn für Steckdosen', level: 2, text: 'Die Küchensteckdosen hängen an 1,5-mm²-Leitung und B16. Das ist nicht zulässig: Die Leitung verträgt nur etwa 16 A bei besten Bedingungen und soll hier nach Norm 2,5 mm² haben. Ändere die Querschnitte der drei Leitungen.',
        hint: 'Tippe eine Leitung an (Auswahl) und wähle rechts „2,5 mm²“. Das machst du für alle drei Leitungen.',
        start: solH(() => dickeHaus(false)), solMake: solH(() => dickeHaus(true)),
        check() { const h = get(), L = [], thin = h.cables.filter(c => c.s < 2.5); L.push(RES(h.cables.length >= 3, h.cables.length >= 3 ? 'Die Leitungen sind noch da' : 'Es fehlen Leitungen')); L.push(RES(!thin.length, !thin.length ? 'Alle Leitungen haben mindestens 2,5 mm²' : thin.length + ' Leitung(en) haben noch 1,5 mm²')); const r = ev(h); L.push(RES(!!K('s3') && r.v[K('s3').id] > 280, K('s3') && r.v[K('s3').id] > 280 ? 'Die Steckdosen haben Spannung' : 'Die Steckdosen haben keine Spannung')); return L; } }),
      mkT({ id: 'ha8', cat: 'Fehlersuche', title: 'Fehlersuche: Küchenlicht bleibt dunkel', level: 3, text: 'Das Küchenlicht geht trotz eingeschaltetem Schalter nicht an. Alles andere funktioniert. Schalte auf „Sim“: An Objekten ohne Spannung steht „ohne Spannung“. Eine Leitung ist defekt (unterbrochen). Lösche sie und ziehe eine neue.',
        hint: 'In „Sim“ siehst du an jedem Gerät die Spannung. Die Lampe der Küche hat keine, der Schalter davor schon: Die Leitung dazwischen ist defekt. Wähle „Zeichnen“, „Löschen“, tippe die Leitung an, dann neu ziehen: Schalter → Lampe.',
        start: solH(() => fehlerHaus(true)), solMake: solH(() => fehlerHaus(false)),
        check() { const h = get(), L = [], r = ev(h), lk = K('lK'); L.push(RES(!h.cables.some(c => c.bad), !h.cables.some(c => c.bad) ? 'Die defekte Leitung ist ersetzt' : 'Die defekte Leitung ist noch eingebaut')); L.push(RES(!!lk && !!r.lit[lk.id], lk && r.lit[lk.id] ? 'Das Küchenlicht brennt' : 'Das Küchenlicht brennt noch nicht')); const sw = K('swK'); const linked = h.cables.some(c => (c.a === sw.id || c.b === sw.id) && (c.a === lk.id || c.b === lk.id)); L.push(RES(linked, linked ? 'Schalter und Lampe sind verbunden' : 'Schalter und Lampe sind nicht verbunden')); return L; } }),
      mkT({ id: 'ha9', cat: 'Fehlersuche', title: 'Fehlersuche: FI löst aus', level: 2, text: 'Im Wohnzimmer löst der FI aus, sobald man die Stehlampe an der zweiten Steckdose anschließt: Sie hat einen Körperschluss. Entferne das defekte Gerät (Steckdose antippen, „Körperschluss beheben“ oder Gerät abziehen) und prüfe, dass alles wieder läuft.',
        hint: 'Wähle die Steckdose „Wohnzimmer“ mit dem Blitz. Rechts steht „Körperschluss beheben“. Danach muss der FI im Verteiler wieder eingeschaltet werden, wenn er ausgelöst hat.',
        start: solH(() => koerperHaus(false)), solMake: solH(() => koerperHaus(true)),
        check() { const h = get(), L = []; const so = K('sW2'); L.push(RES(!so.f, !so.f ? 'Der Körperschluss ist beseitigt' : 'Die Steckdose hat noch einen Körperschluss')); const r = ev(h); L.push(RES(!r.trip.length, !r.trip.length ? 'Kein Schutzschalter löst aus' : 'Es löst noch etwas aus: ' + r.trip[0])); L.push(RES(h.panel.fi[0].on !== 0, h.panel.fi[0].on !== 0 ? 'Der FI ist eingeschaltet' : 'Der FI ist noch aus')); L.push(RES(!!so && r.v[so.id] > 280, so && r.v[so.id] > 280 ? 'Die Steckdose hat Spannung' : 'Die Steckdose hat keine Spannung')); return L; } }),
      mkT({ id: 'ha10', cat: 'Büro', title: 'Büro: Arbeitsplätze auf Stromkreise verteilen', level: 3, text: 'Im Großraumbüro stehen acht Arbeitsplätze mit je 300 W, in Büro 2 ein Heizlüfter (2 kW) plus PC und Beamer. Bestücke den Verteiler (FI 30 mA, drei Automaten B16 hinter dem FI) und verdrahte alle Geräte so, dass kein Automat überlastet ist. Alle müssen laufen.',
        hint: 'Acht PCs sind 2,4 kW (10,4 A): Das passt auf einen B16, mit Reserve besser auf zwei. Der Heizlüfter (8,7 A) plus PC und Beamer ist ein eigener Kreis. Plane die Abgänge und beachte: Ein Abgang kann mehrere Leitungen haben.',
        start: solH(() => bueroHaus(false)), solMake: solH(() => bueroHaus(true)),
        check() { const h = get(), r = ev(h), L = [], P = h.panel, ls = P.slots.filter(s => s.ls); L.push(RES(P.fi.some(f => f.type === '30mA') && ls.length >= 3 && ls.every(s => s.fi > 0), P.fi.some(f => f.type === '30mA') && ls.length >= 3 && ls.every(s => s.fi > 0) ? 'FI und mindestens drei Automaten, alle hinter dem FI' : 'Verteiler: FI 30 mA und drei Automaten hinter dem FI nötig')); const keys = h.objs.filter(o => o.t === 'sock' && o.w > 0).map(o => o.key).filter(k => /^pc|^heiz|^beamer/.test(k)), bad = allPowered(h, keys, r); L.push(RES(!bad.length, !bad.length ? 'Alle Arbeitsplätze und Geräte laufen' : bad.length + ' Gerät(e) ohne Spannung')); const ov = slotOk(h); L.push(RES(!ov.length, !ov.length ? 'Kein Automat ist überlastet' : 'Überlastet: Abgang ' + ov[0])); const thin = secOk(h, keys, 2.5); L.push(RES(!thin.length, !thin.length ? 'Alle Leitungen haben 2,5 mm²' : 'Steckdosenleitungen brauchen 2,5 mm²')); return L; } }),
      mkT({ id: 'ha11', cat: 'Büro', title: 'Server auf einem eigenen Stromkreis', level: 3, text: 'Der Server (1,5 kW) soll nicht an der Teeküche hängen: Wenn der Wasserkocher auslöst, würde der Server ausfallen. Verdrahte um: Der Server bekommt einen eigenen Abgang mit eigener Leitung vom Verteiler, die Teeküche einen anderen.',
        hint: 'Lösche die Leitung zwischen Wasserkocher und Server. Ziehe vom Verteiler eine neue Leitung zum Server (anderer Abgang als beim Wasserkocher).',
        start: solH(() => serverHaus(false)), solMake: solH(() => serverHaus(true)),
        check() { const h = get(), r = ev(h), L = [], srv = K('server'), wk = K('wk'); L.push(RES(!!srv && r.v[srv.id] > 280, srv && r.v[srv.id] > 280 ? 'Der Server läuft' : 'Der Server hat keinen Strom')); L.push(RES(!!wk && r.v[wk.id] > 280, wk && r.v[wk.id] > 280 ? 'Der Wasserkocher läuft' : 'Der Wasserkocher hat keinen Strom')); const sS = r.slotOf[srv.id], sW = r.slotOf[wk.id]; L.push(RES(sS != null && sS !== sW, sS != null && sS !== sW ? 'Server und Teeküche hängen an verschiedenen Abgängen' : 'Server und Teeküche teilen sich noch einen Abgang')); return L; } }),
      mkT({ id: 'ha12', cat: 'Leitungen', title: 'Abzweigdose im Mittelraum', level: 2, text: 'Die Lampe in Raum B liegt nicht direkt neben Raum A: Leitungen dürfen nur in angrenzende Räume. Führe die Leitung über die Abzweigdose im Mittelraum: Verteiler → Schalter → Abzweigdose → Lampe.',
        hint: 'Die Räume sind in einer Reihe. Eine Leitung von Raum A direkt nach Raum B geht nicht. Ziehe Schalter → Abzweigdose (Mittelraum) und dann Abzweigdose → Lampe.',
        start: solH(() => zwischenHaus(false)), solMake: solH(() => zwischenHaus(true)),
        check() { const h = get(), L = [], l = K('l'), j = K('j'), sw = K('sw'); const r1 = ev(withOn(h, [['sw', 1]])), r0 = ev(withOn(h, [['sw', 0]])); const viaJ = h.cables.some(c => c.a === j.id || c.b === j.id); L.push(RES(viaJ, viaJ ? 'Die Abzweigdose ist angeschlossen' : 'Die Abzweigdose fehlt in der Leitung')); L.push(RES(!!r1.lit[l.id], r1.lit[l.id] ? 'Die Lampe in Raum B leuchtet' : 'Die Lampe leuchtet noch nicht')); L.push(RES(!r0.lit[l.id] && !!r1.lit[l.id], !r0.lit[l.id] && r1.lit[l.id] ? 'Der Schalter schaltet die Lampe' : 'Der Schalter schaltet die Lampe noch nicht')); return L; } }),
      mkT({ id: 'ha13', cat: 'Gesamtaufgabe', title: 'Einfamilienhaus komplett installieren', level: 3, text: 'Installiere das Einfamilienhaus von Grund auf: FI 30 mA (4-polig), ein Automat B10 fürs Licht, B16 für die Steckdosenkreise, dreipolige Automaten für Herd (B16), Wallbox (B20) und die CEE-Steckdose (B16). Alle Lampen, Steckdosen und die Drehstromgeräte (Herd, Wallbox, CEE-Steckdose) müssen laufen, die Wechselschaltung im Wohnzimmer muss von beiden Seiten schalten, kein Automat darf überlastet sein, und alle Steckdosenleitungen haben 2,5 mm².',
        hint: 'Gehe Raum für Raum vor: Erst den Verteiler bestücken, dann das Licht (eine Reihe vom Verteiler über die Schalter und Lampen), dann die Steckdosenkreise. Herd, Wallbox und CEE-Steckdose brauchen dreipolige Abgänge und Drehstromleitungen (5-adrig, im Seitenfeld umschalten). Für den Weg in die Küche brauchst du eine Abzweigdose im Wohnzimmer.',
        start: solH(() => haus1('roh')), solMake: solH(() => haus1('fertig')),
        check() { const h = get(), L = [], P = h.panel, r = ev(h); const lamps = h.objs.filter(o => o.t === 'lamp').map(o => o.key); const sw = ['swF', 'cw1', 'swK', 'swB', 'swS'], all = ev(withOn(h, [['swF', 1], ['swK', 1], ['swB', 1], ['swS', 1], ['swGa', 1], ['cw1', 0], ['cw2', 0]]));
          const lampsOn = lamps.filter(k => all.lit[K(k).id]); L.push(RES(lampsOn.length === lamps.length, lampsOn.length === lamps.length ? 'Alle ' + lamps.length + ' Lampen brennen' : lampsOn.length + ' von ' + lamps.length + ' Lampen brennen'));
          const socks = h.objs.filter(o => o.t === 'sock' || o.t === 'dev' || o.t === 'sock3' || o.t === 'dev3').map(o => o.key), bad = allPowered(h, socks, r); L.push(RES(!bad.length, !bad.length ? 'Alle Steckdosen, der Herd, die Wallbox und die CEE-Steckdose haben Spannung' : bad.length + ' Steckdose(n) ohne Spannung'));
          const a = (x, y) => ev(withOn(h, [['cw1', x], ['cw2', y]])).lit[K('lW').id] || false; const w0 = a(0, 0), w1 = a(1, 0), w2 = a(0, 1), w3 = a(1, 1); L.push(RES(w0 !== w1 && w0 !== w2 && w3 === w0, w0 !== w1 && w0 !== w2 && w3 === w0 ? 'Die Wechselschaltung schaltet von beiden Seiten' : 'Die Wechselschaltung im Wohnzimmer arbeitet nicht'));
          const ov = slotOk(h); L.push(RES(!ov.length, !ov.length ? 'Kein Automat ist überlastet' : 'Überlastet: Abgang ' + ov[0])); const thin = secOk(h, socks, 2.5); L.push(RES(!thin.length, !thin.length ? 'Alle Steckdosenleitungen haben 2,5 mm²' : 'Steckdosenleitungen brauchen 2,5 mm²')); const miss = fiBehind(h); L.push(RES(P.fi.some(f => f.type === '30mA') && !miss.length, P.fi.some(f => f.type === '30mA') && !miss.length ? 'Alles liegt hinter dem FI 30 mA' : 'Es fehlt der FI oder ein Abgang liegt nicht dahinter')); L.push(RES(!r.warn.length, !r.warn.length ? 'Keine Hinweise (keine Ringe)' : r.warn[0])); return L; } }),
      mkT({ id: 'ha14', cat: 'Frei gestalten', title: 'Dein eigenes Zimmer installieren', level: 2, text: 'Zeichne einen Raum (Werkzeug „Raum“, mindestens 2 × 2 m), setze Verteilerkasten, Schalter, Lampe und zwei Steckdosen, bestücke den Verteiler (FI und Automaten) und verdrahte alles. Licht und Steckdosen müssen laufen.',
        hint: 'Raum aufziehen, dann „Verteiler“ auf eine Wand tippen, „Schalter“, „Lampe“ (auf den Boden tippen) und „Steckdose“ setzen. Verteiler öffnen und FI sowie B10 und B16 einsetzen. Dann mit „Leitung“ verbinden.',
        start: solH(() => freiHaus()), solMake: solH(() => { const b = B('Mein Zimmer'), R0 = b.R('Zimmer', 0, 0, 4, 4), pan = b.O('pan', 'panel', R0, 'N', 1, 1.5), sw = b.O('sw', 'swi', R0, 'S', 1, 1.05), l = b.O('l', 'lamp', R0, 'C', 2, null, { v: 2 }), s1 = b.O('s1', 'sock', R0, 'W', 1), s2 = b.O('s2', 'sock', R0, 'W', 2.5); b.fi(0); b.ls(0, 'B10', 1); b.ls(1, 'B16', 1); b.C(pan, sw, 1.5, 0); b.C(sw, l); b.chain(1, [s1, s2], 2.5); sw.on = 1; return b.h; }),
        check() { const h = get(), L = [], P = h.panel; L.push(RES(h.rooms.length >= 1, h.rooms.length >= 1 ? 'Ein Raum ist gezeichnet' : 'Zeichne zuerst einen Raum')); L.push(RES(h.objs.some(o => o.t === 'panel'), h.objs.some(o => o.t === 'panel') ? 'Verteilerkasten ist gesetzt' : 'Setze einen Verteilerkasten')); L.push(RES(P.fi.some(f => f.type) && P.slots.some(s => s.ls), P.fi.some(f => f.type) && P.slots.some(s => s.ls) ? 'FI und Automat sind eingesetzt' : 'Bestücke den Verteiler (FI und Automat)')); const sws = h.objs.filter(o => o.t === 'swi'), c2 = JSON.parse(JSON.stringify(h)); c2.objs.forEach(o => { if (o.t === 'swi') o.on = 1; }); const r2 = ev(c2), lamps = h.objs.filter(o => o.t === 'lamp'), socks = h.objs.filter(o => o.t === 'sock');
          L.push(RES(lamps.length > 0 && lamps.some(o => r2.lit[o.id]) && sws.length > 0, lamps.some(o => r2.lit[o.id]) && sws.length > 0 ? 'Eine Lampe leuchtet über den Schalter' : 'Keine Lampe leuchtet über einen Schalter')); const sp = socks.filter(o => r2.v[o.id] > 280); L.push(RES(sp.length >= 2, sp.length >= 2 ? 'Zwei Steckdosen haben Spannung' : 'Mindestens zwei Steckdosen müssen Spannung haben (' + sp.length + ')')); const thin = h.cables.filter(c => { const a = obj0(h, c.a), b = obj0(h, c.b); return ((a && a.t === 'sock') || (b && b.t === 'sock')) && c.s < 2.5; }); L.push(RES(!thin.length, !thin.length ? 'Steckdosenleitungen haben 2,5 mm²' : 'Steckdosenleitungen brauchen 2,5 mm²')); return L; } })
      ,
      mkT({ id: 'ha15', cat: 'Drehstrom', title: 'Drehstrom: Herd anschließen', level: 2, text: 'Der Herd (7 kW) braucht Drehstrom: Er verteilt seine Leistung auf alle drei Phasen. Der Verteiler hat einen vierpoligen FI und einen dreipoligen Automaten B16 (Abgang 1). Ziehe die Leitung vom Verteiler zum Herd als Drehstromleitung (5-adrig, mindestens 2,5 mm²).',
        hint: 'Leitung → Verteiler → Herd, Abgang 1 wählen. Wenn der Abgang dreipolig ist und der Herd ein Drehstromgerät, wird die Leitung automatisch 5-adrig. Prüfe im Seitenfeld die Leitungsart und den Querschnitt. Im Betrieb zeigt der Herd seine Spannung.',
        start: solH(() => herdHaus(false)), solMake: solH(() => herdHaus(true)),
        check() { const h = get(), r = ev(h), L = [], herd = K('herd'), c = h.cables.find(x => x.a === herd.id || x.b === herd.id); L.push(RES(!!c, c ? 'Der Herd ist angeschlossen' : 'Es fehlt die Leitung zum Herd')); L.push(RES(!!c && !!c.ph3, c && c.ph3 ? 'Die Leitung ist eine Drehstromleitung (5-adrig)' : 'Der Herd braucht eine Drehstromleitung (5-adrig)')); L.push(RES(!!c && c.s >= 2.5, c && c.s >= 2.5 ? 'Querschnitt mindestens 2,5 mm²' : 'Der Querschnitt muss mindestens 2,5 mm² betragen')); const p = r.ph3[herd.id] || [0, 0, 0]; L.push(RES(p.every(v => v > 5), p.every(v => v > 5) ? 'Der Herd zieht Strom auf allen drei Phasen' : 'Der Herd läuft noch nicht auf allen drei Phasen')); L.push(RES(!r.trip.length, !r.trip.length ? 'Nichts löst aus' : 'Es löst aus: ' + r.trip[0])); return L; } }),
      mkT({ id: 'ha16', cat: 'Drehstrom', title: 'Wallbox und Durchlauferhitzer absichern', level: 3, text: 'Im Technikraum hängen eine Wallbox (11 kW) und ein Durchlauferhitzer (18 kW). Bestücke den Verteiler (FI 30 mA und zwei dreipolige Automaten) und wähle für jedes Gerät Automat und Querschnitt so, dass nichts auslöst und die Leitung nicht überlastet wird: Der Automat muss den Strom tragen, und die Leitung muss mindestens so viel vertragen wie der Automat.',
        hint: 'Strom je Phase: I = P / (√3 · 400 V). Wallbox 11 kW: etwa 15,9 A, Durchlauferhitzer 18 kW: etwa 26 A. Wähle einen Automaten, der gerade noch über diesem Strom liegt (B16, B32). Leitung: 2,5 mm² verträgt 23 A, 4 mm² 30 A, 6 mm² 38 A. Der Automat darf nicht stärker sein als die Leitung. Je ein eigener Abgang.',
        start: solH(() => grossHaus(false)), solMake: solH(() => grossHaus(true)),
        check() { const h = get(), r = ev(h, { t: 1.5 }), L = [], P = h.panel; L.push(RES(P.fi.some(f => f.type === '30mA'), P.fi.some(f => f.type === '30mA') ? 'FI 30 mA ist eingesetzt' : 'Es fehlt ein FI 30 mA')); [['wb', 'Wallbox', 15.9], ['dl', 'Durchlauferhitzer', 26]].forEach(([k, n, I]) => { const o = K(k), c = h.cables.find(x => (x.a === o.id || x.b === o.id) && x.slot != null), sl = c ? P.slots[c.slot] : null; if (!c || !sl || !sl.ls) { L.push(RES(false, n + ': es fehlt Leitung oder Automat')); return; } const In = lsAmp(sl.ls), iz = root.LochSim.cableOf(c.s + 'mm2 10m').iz; L.push(RES(!!sl.p3 && !!c.ph3, sl.p3 && c.ph3 ? n + ': dreipoliger Abgang und Drehstromleitung' : n + ': braucht einen dreipoligen Abgang und eine Drehstromleitung')); L.push(RES(In >= I, In >= I ? n + ': Automat ' + sl.ls + ' trägt den Strom (' + I.toFixed(1).replace('.', ',') + ' A)' : n + ': der Automat ist zu klein für ' + I.toFixed(1).replace('.', ',') + ' A')); L.push(RES(In <= iz, In <= iz ? n + ': die Leitung ' + String(c.s).replace('.', ',') + ' mm² verträgt den Automaten' : n + ': die Leitung ' + String(c.s).replace('.', ',') + ' mm² (' + iz + ' A) ist für ' + sl.ls + ' zu schwach')); L.push(RES(!!r.lit[o.id] && !r.trip.length, r.lit[o.id] && !r.trip.length ? n + ' läuft' : n + ' läuft nicht oder ein Schutzschalter löst aus')); }); return L; } }),
      mkT({ id: 'ha17', cat: 'Drehstrom', title: 'Phasen gleichmäßig belasten', level: 3, text: 'In der Werkstatt hängen sechs Maschinen (3, 3, 2, 1, 1 und 2 kW) an sechs Stromkreisen, alle auf Phase L1. Das ist Schieflast. Verteile die Stromkreise im Verteilerkasten (Auswahl „Phase L1, L2, L3“ unter jedem Automaten) so, dass die drei Phasen ähnlich belastet sind: höchstens 5 A Unterschied zwischen der größten und der kleinsten Phase.',
        hint: 'Gesamt 12 kW, also gut 4 kW je Phase. Zum Beispiel: Maschine 1 (3 kW) und 4 (1 kW) auf L1, Maschine 2 (3 kW) und 5 (1 kW) auf L2, Maschine 3 (2 kW) und 6 (2 kW) auf L3. Phase einstellen: Verteiler öffnen, beim Automaten „Phase“ wählen.',
        start: solH(() => phaseHaus(false)), solMake: solH(() => phaseHaus(true)),
        check() { const h = get(), r = ev(h), L = [], t = HAUS.houseLoads(h), mx = Math.max(...t), mn = Math.min(...t); L.push(RES(mx - mn <= 5, mx - mn <= 5 ? 'Die Phasen sind gleichmäßig belastet (' + t.map(x => x.toFixed(1).replace('.', ',')).join(' / ') + ' A)' : 'Schieflast: ' + t.map(x => x.toFixed(1).replace('.', ',')).join(' / ') + ' A auf L1 / L2 / L3')); L.push(RES(t.every(x => x > 0), t.every(x => x > 0) ? 'Alle drei Phasen werden genutzt' : 'Mindestens eine Phase hat keine Last')); const bad = h.objs.filter(o => o.t === 'sock' && !(r.v[o.id] > 280)); L.push(RES(!bad.length, !bad.length ? 'Alle Maschinen haben Spannung' : bad.length + ' Maschine(n) ohne Spannung')); L.push(RES(!r.trip.length, !r.trip.length ? 'Nichts löst aus' : 'Es löst aus: ' + r.trip[0])); return L; } }),
      mkT({ id: 'ha18', cat: 'Drehstrom', title: 'Körperschluss am Herd: FI vierpolig', level: 2, text: 'Der Herd hängt an einem dreipoligen Automaten, der Abgang liegt aber nicht hinter dem FI. Bei einem Körperschluss am Herd löst also nichts aus. Hänge den Abgang hinter den FI und prüfe in „Sim“ (Körperschluss am Herd einschalten), dass der vierpolige FI auslöst.',
        hint: 'Verteiler öffnen und beim Automaten „hinter FI 1“ wählen. Der FI ist vierpolig: Er überwacht L1, L2, L3 und N zusammen. In „Sim“ wählst du den Herd und „Körperschluss am Gerät“.',
        start: solH(() => fiHerdHaus(false)), solMake: solH(() => fiHerdHaus(true)),
        check() { const h = get(), L = [], sl = h.panel.slots[0]; L.push(RES(sl.fi > 0 && h.panel.fi[sl.fi - 1].type === '30mA', sl.fi > 0 && h.panel.fi[sl.fi - 1].type === '30mA' ? 'Der Herd-Abgang liegt hinter dem FI 30 mA' : 'Der Herd-Abgang liegt nicht hinter dem FI')); const c1 = JSON.parse(JSON.stringify(h)); byKey(c1, 'herd').f = 1; const r1 = ev(c1), r0 = ev(h); L.push(RES(r1.trip.some(t => /FI/.test(t)), r1.trip.some(t => /FI/.test(t)) ? 'Bei Körperschluss löst der FI aus' : 'Bei Körperschluss löst kein FI aus')); L.push(RES(!r0.trip.length && !!r0.lit[K('herd').id], !r0.trip.length && r0.lit[K('herd').id] ? 'Ohne Fehler läuft der Herd und nichts löst aus' : 'Der Herd läuft nicht ohne Fehler')); return L; } })
    ];
    function obj0(h, id) { return h.objs.find(o => o.id === id); }
    api.addTasks(TASKS);
    root.HAUS_TASKS = TASKS; root.HAUS_BUILD = { haus1, haus2, haus3, B };
  };
})(window);
