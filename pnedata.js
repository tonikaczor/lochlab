'use strict';
/* Tonfunk Pneumatik-Lab: Daten (Bauteile, Symbolbibliothek, Schaltungen, Aufgaben).
   window.PNE_TASKS = [{id,cat,title,level}, ...]   (Schnittstelle fuer die Startseite; gelöste IDs: localStorage['lm4.pne.done'] = {id:true}, Lab-Kennung 'pne')
   window.PNE_DATA = { geom, partName, partDesc, SYMS, CIRCUITS, TASKS (mit allen Details), CATS }
   Symbole nach DIN ISO 1219-1, Anschlussbezeichnungen nach DIN ISO 5599-3 (1 Druck, 2/4 Arbeit, 3/5 Entlueftung, 12/14 Steuer).
   Zahlenwerte sind Richtwerte fuer die Ausbildung; Unsicheres steht mit Pruefen-Marke im Text. */
(function (root) {
  const CORE = root.PNE_CORE || (typeof require !== 'undefined' ? require('./pnecore.js') : null);

  /* ---------------------------------------------------------------- Geometrie (lokale Koordinaten, Anschlussanker + Richtung) */
  function geom(p) {
    const q = CORE.norm(Object.assign({}, p));
    switch (q.t) {
      case 'quelle': return { w: 60, h: 40, ports: { P: { x: 60, y: 20, d: 'r' } }, lab: { x: 4, y: 58 } };
      case 'we': return { w: 70, h: 50, ports: { ein: { x: 0, y: 25, d: 'l' }, aus: { x: 70, y: 25, d: 'r' } }, lab: { x: 4, y: 66 } };
      case 'zyl_ea': return { w: 200, h: 80, ports: { K: { x: 34, y: 76, d: 'd' } }, lab: { x: 128, y: 14 } };
      case 'zyl_da': return { w: 200, h: 80, ports: { K: { x: 34, y: 76, d: 'd' }, S: { x: 106, y: 76, d: 'd' } }, lab: { x: 128, y: 14 } };
      case 'v32': { const o = { '2': { x: 100, y: 0, d: 'u' }, '1': { x: 90, y: 80, d: 'd' }, '3': { x: 110, y: 80, d: 'd' } }; if (q.act === 'pilot') o[q.rest === 'NO' ? '10' : '12'] = { x: 0, y: 40, d: 'l' }; return { w: 150, h: 90, ports: o, lab: { x: 2, y: 14 } }; }
      case 'v52': { const o = { '4': { x: 103, y: 0, d: 'u' }, '2': { x: 127, y: 0, d: 'u' }, '5': { x: 98, y: 80, d: 'd' }, '1': { x: 115, y: 80, d: 'd' }, '3': { x: 132, y: 80, d: 'd' } }; if (q.s14 === 'pilot') o['14'] = { x: 0, y: 40, d: 'l' }; if (q.s12 === 'pilot') o['12'] = { x: 180, y: 40, d: 'r' }; return { w: 180, h: 90, ports: o, lab: { x: 2, y: 14 } }; }
      case 'wv': case 'uv': return { w: 100, h: 70, ports: { '1a': { x: 0, y: 45, d: 'l' }, '1b': { x: 100, y: 45, d: 'r' }, '2': { x: 50, y: 0, d: 'u' } }, lab: { x: 0, y: 16 } };
      case 'dr': return q.vert ? { w: 70, h: 100, ports: { V: { x: 35, y: 100, d: 'd' }, Z: { x: 35, y: 0, d: 'u' } }, lab: { x: 76, y: 54 } } : { w: 100, h: 70, ports: { V: { x: 0, y: 35, d: 'l' }, Z: { x: 100, y: 35, d: 'r' } }, lab: { x: 8, y: 14 } };
      case 'sd': return { w: 30, h: 40, ports: { E: { x: 15, y: 0, d: 'u' } }, lab: { x: 34, y: 20 } };
    }
    return { w: 40, h: 40, ports: {}, lab: { x: 0, y: 10 } };
  }
  const NAMES = { quelle: 'Druckluftquelle', we: 'Wartungseinheit', zyl_ea: 'Einfachwirkender Zylinder', zyl_da: 'Doppeltwirkender Zylinder', v32: '3/2-Wegeventil', v52: '5/2-Wegeventil', wv: 'Wechselventil (ODER)', uv: 'Zweidruckventil (UND)', dr: 'Drossel-Rückschlagventil', sd: 'Schalldämpfer' };
  const ACT = { taster: 'Druckknopf', schalter: 'Handhebel mit Rastung', rolle: 'Rollenhebel', pilot: 'pneumatisch', feder: 'Feder' };
  function partName(p) { return NAMES[p.t] || p.t; }
  function partDesc(p) {
    const q = CORE.norm(Object.assign({}, p));
    if (q.t === 'v32') return '3/2-Wegeventil, ' + ACT[q.act] + ', Feder, in Ruhe ' + (q.rest === 'NO' ? 'offen' : 'gesperrt');
    if (q.t === 'v52') { const a = ACT[q.s14] + (q.s14 === 'pilot' ? ' (14)' : ''), b = q.s12 === 'feder' ? 'Feder' : ACT[q.s12] + ' (12)'; return '5/2-Wegeventil, ' + a + ' / ' + b + (q.s14 === 'pilot' && q.s12 === 'pilot' ? ' (Impulsventil)' : ''); }
    return partName(q);
  }

  /* ---------------------------------------------------------------- Symbolbibliothek */
  const SYMS = [
    { id: 'quelle', name: 'Druckluftquelle', part: { t: 'quelle' }, desc: 'Kompressor bzw. Druckluftnetz. Das Dreieck (in der Pneumatik unausgefüllt) zeigt, dass Druckluft aus dem Symbol herausströmt.', ports: [['P', 'Druckluft (Energiezufuhr)']] },
    { id: 'we', name: 'Wartungseinheit', part: { t: 'we' }, desc: 'Filter mit Wasserabscheider und Druckregler, vereinfacht als Raute. Reinigt die Druckluft und stellt den Arbeitsdruck ein (häufig 6 bar).', ports: [['ein', 'Eingang (von der Quelle)'], ['aus', 'Ausgang (zur Anlage)']] },
    { id: 'zyl_ea', name: 'Einfachwirkender Zylinder', part: { t: 'zyl_ea' }, desc: 'Druckluft bewegt den Kolben nur in eine Richtung (Ausfahren). Die Feder stellt ihn zurück. Es gibt einen Druckanschluss.', ports: [['K', 'Kolbenseite (Druckluft zum Ausfahren)']] },
    { id: 'zyl_da', name: 'Doppeltwirkender Zylinder', part: { t: 'zyl_da' }, desc: 'Druckluft bewegt den Kolben in beide Richtungen. Zwei Anschlüsse, keine Feder.', ports: [['K', 'Kolbenseite (Ausfahren)'], ['S', 'Stangenseite (Einfahren)']] },
    { id: 'v32nc', name: '3/2-Wegeventil, Druckknopf, in Ruhe gesperrt', part: { t: 'v32', id: 'v', rest: 'NC', act: 'taster' }, desc: 'Drei Anschlüsse, zwei Schaltstellungen. Ruhestellung (Federseite, rechtes Feld): 1 gesperrt, 2 über 3 entlüftet. Betätigt (linkes Feld): 1 nach 2 durchgeschaltet.', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['3', 'Entlüftung']] },
    { id: 'v32no', name: '3/2-Wegeventil, Druckknopf, in Ruhe offen', part: { t: 'v32', id: 'v', rest: 'NO', act: 'taster' }, desc: 'Ruhestellung (Federseite): 1 nach 2 durchgeschaltet. Betätigt: 1 gesperrt, 2 über 3 entlüftet. Wirkt wie ein „Öffner“.', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['3', 'Entlüftung']] },
    { id: 'v32r', name: '3/2-Wegeventil, Rollenhebel', part: { t: 'v32', id: 'v', rest: 'NC', act: 'rolle' }, desc: 'Wird mechanisch betätigt, z. B. von der Kolbenstange oder einem Nocken. Typisch als Endlagen-Signalgeber.', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['3', 'Entlüftung']] },
    { id: 'v32s', name: '3/2-Wegeventil, Handhebel mit Rastung', part: { t: 'v32', id: 'v', rest: 'NC', act: 'schalter' }, desc: 'Bleibt in der geschalteten Stellung (Rastung), z. B. als Ein/Aus-Schalter einer Anlage.', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['3', 'Entlüftung']] },
    { id: 'v32p', name: '3/2-Wegeventil, pneumatisch betätigt', part: { t: 'v32', id: 'v', rest: 'NC', act: 'pilot' }, desc: 'Wird durch Steuerluft am Anschluss 12 geschaltet (1 nach 2). Ohne Steuerluft schaltet die Feder zurück.', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['3', 'Entlüftung'], ['12', 'Steueranschluss (1 nach 2)']] },
    { id: 'v52t', name: '5/2-Wegeventil, Druckknopf mit Feder', part: { t: 'v52', id: 'v', s14: 'taster', s12: 'feder' }, desc: 'Fünf Arbeitsanschlüsse, zwei Stellungen. Ruhe: 1 nach 2 (4 über 5 entlüftet). Betätigt: 1 nach 4 (2 über 3 entlüftet).', ports: [['1', 'Druckanschluss'], ['2', 'Arbeitsanschluss'], ['4', 'Arbeitsanschluss'], ['3', 'Entlüftung von 2'], ['5', 'Entlüftung von 4']] },
    { id: 'v52p', name: '5/2-Wegeventil, pneumatisch (14) mit Feder', part: { t: 'v52', id: 'v', s14: 'pilot', s12: 'feder' }, desc: 'Steuerluft an 14 schaltet 1 nach 4. Ohne Steuerluft stellt die Feder 1 nach 2 wieder her.', ports: [['14', 'Steueranschluss (1 nach 4)'], ['1', 'Druck'], ['2', 'Arbeit'], ['4', 'Arbeit'], ['3', 'Entlüftung'], ['5', 'Entlüftung']] },
    { id: 'v52i', name: '5/2-Impulsventil (beidseitig pneumatisch)', part: { t: 'v52', id: 'v', s14: 'pilot', s12: 'pilot' }, desc: 'Zwei Steueranschlüsse, keine Feder. Das Ventil bleibt in der zuletzt geschalteten Stellung (Speicherverhalten). 14: 1 nach 4, 12: 1 nach 2.', ports: [['14', 'Steueranschluss (1 nach 4)'], ['12', 'Steueranschluss (1 nach 2)'], ['1', 'Druck'], ['2', 'Arbeit'], ['4', 'Arbeit'], ['3', 'Entlüftung'], ['5', 'Entlüftung']] },
    { id: 'wv', name: 'Wechselventil (ODER)', part: { t: 'wv' }, desc: 'Ausgang 2 hat Druck, wenn an mindestens einem der beiden Eingänge Druck anliegt. Die Kugel sperrt den Eingang ohne Druck.', ports: [['1a', 'Eingang (1)'], ['1b', 'Eingang (1)'], ['2', 'Ausgang']] },
    { id: 'uv', name: 'Zweidruckventil (UND)', part: { t: 'uv' }, desc: 'Ausgang 2 hat nur Druck, wenn an beiden Eingängen Druck anliegt (Sicherheitsschaltung, z. B. Zweihandbedienung).', ports: [['1a', 'Eingang (1)'], ['1b', 'Eingang (1)'], ['2', 'Ausgang']] },
    { id: 'dr', name: 'Drossel-Rückschlagventil', part: { t: 'dr' }, desc: 'In einer Richtung gedrosselt (einstellbarer Querschnitt), in der Gegenrichtung strömt die Luft frei durch das Rückschlagventil. Zur Geschwindigkeitseinstellung von Zylindern.', ports: [['V', 'zum Ventil (frei in Richtung Zylinder)'], ['Z', 'zum Zylinder (gedrosselt in Richtung Ventil)']] },
    { id: 'sd', name: 'Schalldämpfer / Entlüftung', part: { t: 'sd' }, desc: 'Dämpft das Abblasgeräusch. Das offene Dreieck bedeutet: Abluft geht ins Freie.', ports: [['E', 'Abluft ins Freie']] }
  ];

  /* ---------------------------------------------------------------- Schaltungen */
  const P = (id, t, x, y, o) => Object.assign({ id, t, x, y }, o || {});
  const SUP = (x, y) => [P('q', 'quelle', x, y, { label: '0Z0' }), P('we', 'we', x + 72, y - 5, { label: '0Z1' })];
  const FIXQ = [['q.P', 'we.ein']];
  const press = (id, w) => ({ text: 'Zylinder fährt aus, solange der Taster ' + (w || id) + ' gedrückt ist', steps: [{ set: { [id]: 1 }, reach: { z1: 'out' }, max: 4 }] });
  const rel = (id) => ({ text: 'Zylinder fährt nach dem Loslassen wieder ein', steps: [{ set: { [id]: 1 }, wait: 2.5 }, { set: { [id]: 0 }, reach: { z1: 'in' }, max: 4 }] });
  const rest = { text: 'Ohne Betätigung bleibt der Zylinder eingefahren', steps: [{ wait: 2, expect: { z1: 'in' } }] };

  const CIRCUITS = {
    ea_dk: {
      id: 'ea_dk', title: 'Einfachwirkender Zylinder mit Taster', W: 460, H: 300,
      desc: 'Ein 3/2-Wegeventil (Druckknopf, in Ruhe gesperrt) steuert einen einfachwirkenden Zylinder direkt. Solange der Taster gedrückt ist, strömt Druckluft von 1 nach 2 in den Zylinder. Beim Loslassen wird der Zylinder über 2 nach 3 entlüftet und die Feder fährt ihn zurück.',
      parts: SUP(10, 235).concat([P('z1', 'zyl_ea', 240, 10, { label: '1A1' }), P('s1', 'v32', 170, 140, { label: '1S1', rest: 'NC', act: 'taster' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['s1.2', 'z1.K']],
      wrong: [['we.aus', 's1.2'], ['s1.1', 'z1.K']],
      checks: [press('s1', '1S1'), rel('s1'), rest]
    },
    da_52: {
      id: 'da_52', title: 'Doppeltwirkender Zylinder mit 5/2-Ventil', W: 460, H: 320,
      desc: 'Das 5/2-Wegeventil (Druckknopf, Federrückstellung) steuert einen doppeltwirkenden Zylinder. In Ruhe liegt der Druck über 1 nach 2 an der Stangenseite (Zylinder eingefahren), 4 wird über 5 entlüftet. Betätigt: 1 nach 4, Kolbenseite belüftet, Zylinder fährt aus; 2 wird über 3 entlüftet.',
      parts: SUP(10, 255).concat([P('z1', 'zyl_da', 230, 10, { label: '1A1' }), P('v1', 'v52', 150, 150, { label: '1V1', s14: 'taster', s12: 'feder' })]),
      fixed: FIXQ,
      ref: [['we.aus', 'v1.1'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      wrong: [['we.aus', 'v1.1'], ['v1.4', 'z1.S'], ['v1.2', 'z1.K']],
      checks: [{ text: 'Zylinder fährt aus, solange der Taster gedrückt ist', steps: [{ set: { v1: 1 }, reach: { z1: 'out' }, max: 4 }] }, rel('v1'), rest]
    },
    indirekt: {
      id: 'indirekt', title: 'Indirekte Ansteuerung mit Vorsteuerventil', W: 540, H: 350,
      desc: 'Der Taster 1S1 (3/2) schaltet nur die kleine Steuerluft. Sie schaltet das 5/2-Hauptventil 1V1 über Anschluss 14 um, das den großen Volumenstrom für den Zylinder liefert. Beim Loslassen von 1S1 wird die Steuerleitung entlüftet und die Feder stellt 1V1 zurück.',
      parts: SUP(10, 295).concat([P('z1', 'zyl_da', 310, 10, { label: '1A1' }), P('v1', 'v52', 280, 130, { label: '1V1', s14: 'pilot', s12: 'feder' }), P('s1', 'v32', 110, 190, { label: '1S1', rest: 'NC', act: 'taster' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 'v1.1'], ['s1.2', 'v1.14'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      wrong: [['we.aus', 'v1.1'], ['s1.2', 'v1.14'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      checks: [press('s1', '1S1'), rel('s1'), rest]
    },
    und: {
      id: 'und', title: 'Zweihandschaltung (UND)', W: 460, H: 350,
      desc: 'Zwei Taster 1S1 und 1S2 liefern ihre Signale an das Zweidruckventil (UND). Nur wenn beide Eingänge Druck haben, gelangt Druck zum Ausgang und der einfachwirkende Zylinder fährt aus. Typisch für Sicherheitsschaltungen: beide Hände müssen an die Taster.',
      parts: SUP(10, 295).concat([P('z1', 'zyl_ea', 150, 10, { label: '1A1' }), P('u1', 'uv', 210, 110, { label: '1V1' }), P('s1', 'v32', 90, 190, { label: '1S1', rest: 'NC', act: 'taster' }), P('s2', 'v32', 290, 190, { label: '1S2', rest: 'NC', act: 'taster' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['s1.2', 'u1.1a'], ['s2.2', 'u1.1b'], ['u1.2', 'z1.K']],
      wrong: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['s1.2', 'z1.K']],
      checks: [
        { text: 'Nur 1S1 gedrückt: Zylinder bleibt eingefahren', steps: [{ set: { s1: 1 }, wait: 2.5, expect: { z1: 'in' } }] },
        { text: 'Nur 1S2 gedrückt: Zylinder bleibt eingefahren', steps: [{ set: { s2: 1 }, wait: 2.5, expect: { z1: 'in' } }] },
        { text: 'Beide Taster gedrückt: Zylinder fährt aus', steps: [{ set: { s1: 1, s2: 1 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'Nach dem Loslassen fährt der Zylinder wieder ein', steps: [{ set: { s1: 1, s2: 1 }, wait: 2.5 }, { set: { s1: 0, s2: 0 }, reach: { z1: 'in' }, max: 4 }] }
      ]
    },
    oder: {
      id: 'oder', title: 'Bedienung von zwei Stellen (ODER)', W: 460, H: 350,
      desc: 'Der Zylinder soll von zwei Bedienplätzen aus ausfahren können. Das Wechselventil (ODER) gibt Druck an den Ausgang, sobald mindestens ein Eingang Druck hat. Die Kugel im Ventil sperrt dabei den Eingang ohne Druck, damit die Luft nicht über das andere Taster-Ventil entweicht.',
      parts: SUP(10, 295).concat([P('z1', 'zyl_ea', 150, 10, { label: '1A1' }), P('w1', 'wv', 210, 110, { label: '1V1' }), P('s1', 'v32', 90, 190, { label: '1S1', rest: 'NC', act: 'taster' }), P('s2', 'v32', 290, 190, { label: '1S2', rest: 'NC', act: 'taster' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['s1.2', 'w1.1a'], ['s2.2', 'w1.1b'], ['w1.2', 'z1.K']],
      wrong: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['s1.2', 'z1.K'], ['s2.2', 'z1.K']],
      checks: [
        { text: 'Nur 1S1 gedrückt: Zylinder fährt aus', steps: [{ set: { s1: 1 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'Nur 1S2 gedrückt: Zylinder fährt aus', steps: [{ set: { s2: 1 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'Beide Taster gedrückt: Zylinder fährt aus', steps: [{ set: { s1: 1, s2: 1 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'Nach dem Loslassen fährt der Zylinder wieder ein', steps: [{ set: { s2: 1 }, wait: 2.5 }, { set: { s2: 0 }, reach: { z1: 'in' }, max: 4 }] },
        rest
      ]
    },
    lang: {
      id: 'lang', title: 'Langsam ausfahren mit Abluftdrosselung', W: 440, H: 410,
      desc: 'Beim Ausfahren strömt die Luft der Stangenseite über das Drossel-Rückschlagventil ab. Der Rückschlagweg ist in dieser Richtung gesperrt, die Luft muss durch die einstellbare Drossel: der Kolben fährt langsam und gleichmäßig aus (Abluftdrosselung). Beim Einfahren strömt die Luft frei durch das Rückschlagventil zum Zylinder, der Rückhub ist schnell.',
      parts: SUP(10, 345).concat([P('z1', 'zyl_da', 211, 10, { label: '1A1' }), P('d1', 'dr', 282, 95, { label: '1V2', vert: true }), P('v1', 'v52', 60, 235, { label: '1V1', s14: 'taster', s12: 'feder' })]),
      fixed: FIXQ,
      ref: [['we.aus', 'v1.1'], ['v1.4', 'z1.K'], ['v1.2', 'd1.V'], ['d1.Z', 'z1.S']],
      wrong: [['we.aus', 'v1.1'], ['v1.4', 'd1.V'], ['d1.Z', 'z1.K'], ['v1.2', 'z1.S']],
      checks: [
        { text: 'Zylinder fährt aus, solange der Taster gedrückt ist', steps: [{ set: { v1: 1 }, reach: { z1: 'out' }, max: 10 }] },
        { text: 'Das Ausfahren geschieht langsam (gedrosselt)', steps: [{ set: { v1: 1 }, reach: { z1: 'out' }, max: 10, tmin: 2 }] },
        { text: 'Der Rückhub geschieht zügig (nicht gedrosselt)', steps: [{ set: { v1: 1 }, reach: { z1: 'out' }, max: 10 }, { set: { v1: 0 }, reach: { z1: 'in' }, max: 4, tmax: 1.6 }] },
        rest
      ]
    },
    imp: {
      id: 'imp', title: 'Selbsthaltung mit Impulsventil', W: 650, H: 350,
      desc: 'Das Impulsventil 1V1 hat auf beiden Seiten einen Steueranschluss und keine Feder. Ein kurzer Impuls von 1S1 an 14 schaltet es auf „Ausfahren“, und es bleibt in dieser Stellung, auch wenn 1S1 losgelassen wird (Speicherverhalten). Erst ein Impuls von 1S2 an 12 stellt es auf „Einfahren“ zurück.',
      parts: SUP(10, 295).concat([P('z1', 'zyl_da', 310, 10, { label: '1A1' }), P('v1', 'v52', 280, 130, { label: '1V1', s14: 'pilot', s12: 'pilot' }), P('s1', 'v32', 110, 190, { label: '1S1', rest: 'NC', act: 'taster' }), P('s2', 'v32', 480, 190, { label: '1S2', rest: 'NC', act: 'taster' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['we.aus', 'v1.1'], ['s1.2', 'v1.14'], ['s2.2', 'v1.12'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      wrong: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['we.aus', 'v1.1'], ['s1.2', 'v1.12'], ['s2.2', 'v1.14'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      checks: [
        { text: 'Kurzer Druck auf 1S1: Zylinder fährt aus', steps: [{ set: { s1: 1 }, wait: 0.3 }, { set: { s1: 0 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'Nach Loslassen von 1S1 bleibt der Zylinder ausgefahren', steps: [{ set: { s1: 1 }, wait: 0.3 }, { set: { s1: 0 }, wait: 4, expect: { z1: 'out' } }] },
        { text: 'Kurzer Druck auf 1S2: Zylinder fährt wieder ein und bleibt eingefahren', steps: [{ set: { s1: 1 }, wait: 0.3 }, { set: { s1: 0 }, wait: 3 }, { set: { s2: 1 }, wait: 0.3 }, { set: { s2: 0 }, wait: 3, expect: { z1: 'in' } }] },
        { text: 'Ohne Betätigung bleibt der Zylinder in Ruhe', steps: [{ wait: 2, expect: { z1: 'in' } }] }
      ]
    },
    autoruck: {
      id: 'autoruck', title: 'Selbsttätiger Rückhub mit Rollenhebel', W: 650, H: 350,
      desc: 'Ein kurzer Impuls von 1S1 fährt den Zylinder aus (Impulsventil an 14). In der vorderen Endlage betätigt die Kolbenstange den Rollenhebel 1B2. Dessen Signal schaltet das Impulsventil über 12 um, und der Zylinder fährt von selbst wieder ein.',
      parts: SUP(10, 295).concat([P('z1', 'zyl_da', 310, 10, { label: '1A1', marks: [{ at: 'out', label: '1B2' }] }), P('v1', 'v52', 280, 130, { label: '1V1', s14: 'pilot', s12: 'pilot' }), P('s1', 'v32', 110, 190, { label: '1S1', rest: 'NC', act: 'taster' }), P('b2', 'v32', 480, 190, { label: '1B2', rest: 'NC', act: 'rolle', sensor: { cyl: 'z1', at: 'out' } })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 'b2.1'], ['we.aus', 'v1.1'], ['s1.2', 'v1.14'], ['b2.2', 'v1.12'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      wrong: [['we.aus', 's1.1'], ['we.aus', 'b2.1'], ['we.aus', 'v1.1'], ['s1.2', 'v1.14'], ['b2.2', 'v1.14'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      checks: [
        { text: 'Kurzer Druck auf 1S1: Zylinder fährt bis zur vorderen Endlage aus', steps: [{ set: { s1: 1 }, reach: { z1: 'out' }, max: 4 }] },
        { text: 'In der vorderen Endlage fährt der Zylinder selbsttätig zurück', steps: [{ set: { s1: 1 }, wait: 0.3 }, { set: { s1: 0 }, wait: 6, expect: { z1: 'in' }, cycles: { z1: 1 } }] },
        { text: 'Ohne Start bleibt der Zylinder eingefahren', steps: [{ wait: 2, expect: { z1: 'in' } }] }
      ]
    },
    hinher: {
      id: 'hinher', title: 'Automatisches Hin- und Herfahren', W: 650, H: 450,
      desc: 'Der Handhebel 1S1 (mit Rastung) gibt Druckluft für die beiden Endlagen-Rollenhebel 1B1 (hinten) und 1B2 (vorn) frei. In der hinteren Endlage schaltet 1B1 das Impulsventil auf „Ausfahren“, in der vorderen schaltet 1B2 auf „Einfahren“: der Zylinder läuft selbsttätig hin und her, solange 1S1 eingeschaltet ist.',
      parts: SUP(10, 395).concat([P('z1', 'zyl_da', 310, 10, { label: '1A1', marks: [{ at: 'in', label: '1B1' }, { at: 'out', label: '1B2' }] }), P('v1', 'v52', 280, 130, { label: '1V1', s14: 'pilot', s12: 'pilot' }), P('b1', 'v32', 110, 190, { label: '1B1', rest: 'NC', act: 'rolle', sensor: { cyl: 'z1', at: 'in' } }), P('b2', 'v32', 470, 190, { label: '1B2', rest: 'NC', act: 'rolle', sensor: { cyl: 'z1', at: 'out' } }), P('sw', 'v32', 420, 290, { label: '1S1', rest: 'NC', act: 'schalter' })]),
      fixed: FIXQ,
      ref: [['we.aus', 'v1.1'], ['we.aus', 'sw.1'], ['sw.2', 'b1.1'], ['sw.2', 'b2.1'], ['b1.2', 'v1.14'], ['b2.2', 'v1.12'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      wrong: [['we.aus', 'v1.1'], ['we.aus', 'sw.1'], ['sw.2', 'b1.1'], ['sw.2', 'b2.1'], ['b1.2', 'v1.12'], ['b2.2', 'v1.14'], ['v1.4', 'z1.K'], ['v1.2', 'z1.S']],
      checks: [
        { text: 'Ohne Einschalten bleibt der Zylinder in Ruhe', steps: [{ wait: 3, expect: { z1: 'in' } }] },
        { text: 'Eingeschaltet fährt der Zylinder selbsttätig hin und her (mindestens 2 Hübe)', steps: [{ set: { sw: 1 }, wait: 7, cycles: { z1: 2 } }] },
        { text: 'Ausgeschaltet bleibt der Zylinder in einer Endlage stehen', steps: [{ set: { sw: 1 }, wait: 2.2 }, { set: { sw: 0 }, wait: 4, expect: { z1: 'end' } }] }
      ]
    },
    /* PRUEFEN P1: Presse mit Zweihandstart, Abluftdrosselung und Not-Aus (Anlehnung an die Komplexaufgabe im Lernfeld Pneumatik). Vereinfachtes Modell:
       Liegen Startsignal (14) und Rückhubsignal (12) am Impulsventil gleichzeitig an, bleibt die Stellung erhalten; in einer echten Presse muss das Not-Aus-Signal Vorrang haben. */
    presse: {
      id: 'presse', title: 'Presse mit Zweihandstart, Drosselung und Not-Aus', W: 790, H: 525,
      desc: 'Die Presse fährt nur aus, wenn beide Taster 1S1 und 1S2 gedrückt sind: Das Zweidruckventil 1V3 (UND) gibt dann ein Impulssignal an 14 des Impulsventils 1V1. Die Drossel 1V2 bremst die Abluft der Stangenseite, der Stempel fährt langsam aus. Zurück geht es über Anschluss 12: Das Wechselventil 1V4 (ODER) führt das Signal des Rollenhebels 1B2 (vordere Endlage) und des Not-Aus-Ventils 0S1 zusammen, eines von beiden genügt.',
      parts: SUP(10, 470).concat([P('z1', 'zyl_da', 451, 10, { label: '1A1', marks: [{ at: 'out', label: '1B2' }] }), P('d1', 'dr', 522, 95, { label: '1V2', vert: true }), P('v1', 'v52', 300, 235, { label: '1V1', s14: 'pilot', s12: 'pilot' }), P('s1', 'v32', 80, 372, { label: '1S1', rest: 'NC', act: 'taster' }), P('s2', 'v32', 235, 372, { label: '1S2', rest: 'NC', act: 'taster' }), P('u1', 'uv', 200, 290, { label: '1V3' }), P('b2', 'v32', 440, 372, { label: '1B2', rest: 'NC', act: 'rolle', sensor: { cyl: 'z1', at: 'out' } }), P('na', 'v32', 600, 372, { label: '0S1', rest: 'NC', act: 'schalter' }), P('w1', 'wv', 560, 296, { label: '1V4' })]),
      fixed: FIXQ,
      ref: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['we.aus', 'v1.1'], ['we.aus', 'b2.1'], ['we.aus', 'na.1'], ['s1.2', 'u1.1a'], ['s2.2', 'u1.1b'], ['u1.2', 'v1.14'], ['b2.2', 'w1.1a'], ['na.2', 'w1.1b'], ['w1.2', 'v1.12'], ['v1.4', 'z1.K'], ['v1.2', 'd1.V'], ['d1.Z', 'z1.S']],
      wrong: [['we.aus', 's1.1'], ['we.aus', 's2.1'], ['we.aus', 'v1.1'], ['we.aus', 'b2.1'], ['we.aus', 'na.1'], ['s1.2', 'u1.1a'], ['s2.2', 'u1.1b'], ['u1.2', 'v1.14'], ['b2.2', 'v1.12'], ['na.2', 'v1.12'], ['v1.4', 'z1.K'], ['v1.2', 'd1.V'], ['d1.Z', 'z1.S']],
      checks: [
        { text: 'Nur ein Taster gedrückt: Der Stempel bleibt eingefahren', steps: [{ set: { s1: 1 }, wait: 2.5, expect: { z1: 'in' } }] },
        { text: 'Beide Taster gedrückt: Der Stempel fährt aus', steps: [{ set: { s1: 1, s2: 1 }, reach: { z1: 'out' }, max: 10 }] },
        { text: 'Das Ausfahren geschieht langsam (gedrosselt)', steps: [{ set: { s1: 1, s2: 1 }, reach: { z1: 'out' }, max: 10, tmin: 2 }] },
        { text: 'In der vorderen Endlage fährt der Stempel zurück, sobald beide Taster losgelassen sind', steps: [{ set: { s1: 1, s2: 1 }, reach: { z1: 'out' }, max: 10 }, { set: { s1: 0, s2: 0 }, reach: { z1: 'in' }, max: 4 }] },
        { text: 'Not-Aus mitten im Hub: Der Stempel fährt sofort zurück', steps: [{ set: { s1: 1, s2: 1 }, wait: 0.6 }, { set: { s1: 0, s2: 0 }, wait: 0.3 }, { set: { na: 1 }, reach: { z1: 'in' }, max: 3 }] },
        { text: 'Ohne Betätigung bleibt der Stempel eingefahren', steps: [{ wait: 2, expect: { z1: 'in' } }] }
      ]
    }
  };

  Object.keys(CIRCUITS).forEach(k => { CIRCUITS[k].H += 26; });   /* Platz fuer die Beschriftung der Versorgung */

  /* ---------------------------------------------------------------- Aufgaben */
  const fm = CORE.calc.fmt;
  const CATS = ['Symbole erkennen', 'Anschlussbezeichnungen', 'Schaltplan lesen', 'Verschlauchen', 'Kraft und Luftverbrauch', 'Druckluft erzeugen und aufbereiten'];
  const T = [];
  const mc = (cat, level, title, text, sym, opts, ans, tips, expl) => T.push({ cat, level, title, type: 'mc', text, sym, opts, ans, tips, expl });
  const tap = (cat, level, title, text, sym, ans, tips, expl) => T.push({ cat, level, title, type: 'tap', text, sym, ans, tips, expl });
  const SY = 'Symbole erkennen', AN = 'Anschlussbezeichnungen', LE = 'Schaltplan lesen', VE = 'Verschlauchen', KR = 'Kraft und Luftverbrauch', DL = 'Druckluft erzeugen und aufbereiten';
  const V32 = (o) => Object.assign({ t: 'v32', id: 'v', rest: 'NC', act: 'taster' }, o || {});
  const V52 = (o) => Object.assign({ t: 'v52', id: 'v', s14: 'taster', s12: 'feder' }, o || {});

  /* --- Symbole erkennen */
  mc(SY, 1, 'Zylinder erkennen', 'Welches Bauteil zeigt das Symbol?', { t: 'zyl_da' }, ['Doppeltwirkender Zylinder', 'Einfachwirkender Zylinder mit Federrückstellung', 'Wartungseinheit', 'Druckluftquelle'], 0,
    ['Zähle die Druckluftanschlüsse am Zylinder und achte darauf, ob eine Feder eingezeichnet ist.', 'Das Symbol hat zwei Anschlüsse (Kolben- und Stangenseite) und keine Feder.', 'Zwei Anschlüsse, keine Feder: Der Zylinder wird in beide Richtungen mit Druckluft bewegt, er ist doppeltwirkend.'],
    'Ein doppeltwirkender Zylinder hat zwei Druckluftanschlüsse. Je nachdem, welche Kammer Druck bekommt, fährt der Kolben aus oder ein.');
  mc(SY, 1, 'Wie kommt der Kolben zurück?', 'Wie kehrt der Kolben dieses Zylinders in die Ausgangslage zurück?', { t: 'zyl_ea' }, ['Durch Druckluft auf der Stangenseite', 'Durch die eingebaute Rückstellfeder', 'Durch die Schwerkraft', 'Durch ein zweites Ventil'], 1,
    ['Schau in die Stangenseite des Zylinders: Was ist dort eingezeichnet?', 'Es gibt nur einen Druckluftanschluss. Das Zickzack-Symbol ist eine Feder.', 'Die Feder schiebt den Kolben zurück, sobald die Druckluft entweicht (einfachwirkender Zylinder).'],
    'Beim einfachwirkenden Zylinder arbeitet die Druckluft nur in eine Richtung (Ausfahren). Die Feder stellt den Kolben zurück, wenn der Zylinder entlüftet wird.');
  mc(SY, 1, 'Wartungseinheit', 'Wofür steht dieses Symbol?', { t: 'we' }, ['Druckluftquelle (Kompressor)', 'Wartungseinheit (Filter und Druckregler)', 'Schalldämpfer', 'Drossel-Rückschlagventil'], 1,
    ['Das Symbol hat einen Eingang links und einen Ausgang rechts.', 'Die Raute steht für die Aufbereitung der Luft: Filter und Druckregler.', 'Die Wartungseinheit reinigt die Druckluft und regelt den Arbeitsdruck. Sie sitzt direkt hinter der Druckluftquelle.'],
    'Die Wartungseinheit besteht aus Filter mit Wasserabscheider, Druckregler (und bei Bedarf Öler). Vereinfacht wird sie als Raute gezeichnet.');
  mc(SY, 2, '3/2-Ventil lesen', 'Was zeigt dieses Symbol (Betätigung: Druckknopf, Rückstellung: Feder)?', V32(), ['3/2-Wegeventil, in Ruhestellung gesperrt', '3/2-Wegeventil, in Ruhestellung durchgeschaltet', '5/2-Wegeventil mit Druckknopf', '2/2-Wegeventil mit Feder'], 0,
    ['Zähle die Anschlüsse (erste Zahl) und die Schaltstellungen, also die Felder (zweite Zahl).', 'Es sind drei Anschlüsse und zwei Felder. Die Anschlüsse liegen am Feld der Ruhestellung (Federseite, rechts).', 'Im rechten Feld ist Anschluss 1 durch ein T verschlossen: in Ruhe gesperrt, 2 ist über 3 entlüftet.'],
    'Wegeventile werden mit „Anschlüsse/Stellungen“ benannt. 3/2 heißt drei Anschlüsse, zwei Stellungen. Gedrückt wird das linke Feld wirksam: 1 nach 2.');
  mc(SY, 2, 'Ruhestellung offen', 'In welchem Zustand ist dieses Ventil, wenn niemand den Taster drückt?', V32({ rest: 'NO' }), ['Durchgeschaltet: Druckluft strömt von 1 nach 2', 'Gesperrt: Anschluss 2 wird über 3 entlüftet', 'Anschluss 1 und 3 sind verbunden', 'Alle Anschlüsse sind gesperrt'], 0,
    ['Die Ruhestellung ist das Feld an der Federseite, dort sind die Leitungen angeschlossen.', 'Im Feld der Federseite (rechts) verbindet ein Pfeil 1 mit 2.', 'In Ruhe offen: 1 nach 2 durchgeschaltet. Erst durch Betätigen sperrt das Ventil (Öffner-Verhalten).'],
    'Bei „in Ruhe offen“ (NO) liegt Druck am Ausgang 2, solange das Ventil nicht betätigt ist. Betätigen sperrt 1 und entlüftet 2.');
  mc(SY, 2, 'UND oder ODER?', 'Welche Verknüpfung stellt dieses Ventil her?', { t: 'uv' }, ['UND: Ausgang hat nur Druck, wenn beide Eingänge Druck haben', 'ODER: Ausgang hat Druck, wenn mindestens ein Eingang Druck hat', 'NICHT: das Signal wird umgekehrt', 'Speicher: das Signal bleibt erhalten'], 0,
    ['Bei einem Wechselventil sieht man eine Kugel zwischen zwei Sitzen, beim Zweidruckventil zwei gegeneinander gerichtete Dreiecke.', 'Zwei Pfeile weisen auf die Mitte: Der Ausgang bekommt nur Druck, wenn von beiden Seiten Druck kommt.', 'Das ist das Zweidruckventil (UND). Das Wechselventil (ODER) wird mit einer Kugel gezeichnet.'],
    'Zweidruckventil = UND (Zweihandschaltung, Sicherheit). Wechselventil = ODER (Bedienung von mehreren Stellen).');
  mc(SY, 2, 'Drossel-Rückschlagventil', 'Was macht dieses Bauteil?', { t: 'dr' }, ['In einer Richtung drosselt es, in der Gegenrichtung strömt die Luft frei durch das Rückschlagventil', 'Es sperrt die Luft in beide Richtungen', 'Es entlüftet den Zylinder ins Freie', 'Es erhöht den Druck'], 0,
    ['Das Symbol besteht aus zwei parallelen Wegen: einer Drossel und einem Rückschlagventil.', 'Das Rückschlagventil lässt die Luft nur in eine Richtung durch, die Drossel verengt den Querschnitt für die andere.', 'Gedrosselt wird in der Sperrrichtung des Rückschlagventils. Damit stellt man die Zylindergeschwindigkeit ein.'],
    'Das Drossel-Rückschlagventil wird in die Zu- oder Abluftleitung eines Zylinders eingebaut und stellt dessen Geschwindigkeit ein.');

  /* --- Anschlussbezeichnungen */
  mc(AN, 1, 'Anschluss 1', 'Welche Bedeutung hat der Anschluss 1 bei einem Wegeventil?', V52(), ['Druckluftanschluss (Versorgung)', 'Arbeitsanschluss zum Zylinder', 'Entlüftung', 'Steueranschluss'], 0,
    ['Die Anschlüsse sind nach DIN ISO 5599 nummeriert. Die 1 steht immer für die Energie.', 'Die Druckluft von der Wartungseinheit wird an 1 angeschlossen.', '1 = Druckluftanschluss, 2 und 4 = Arbeitsanschlüsse, 3 und 5 = Entlüftungen, 12 und 14 = Steueranschlüsse.'],
    'Merke: 1 Druck, 2/4 Arbeit, 3/5 Entlüftung, 10/12/14 Steuerluft.');
  tap(AN, 1, 'Druckanschluss finden', 'Tippe im Symbol auf den Druckluftanschluss (Anschluss 1).', V52(), ['1'],
    ['Der Druckluftanschluss trägt die Nummer 1.', 'Bei 5/2-Ventilen liegt die 1 in der Mitte der unteren Reihe.', 'Die untere Reihe von links: 5, 1, 3. Oben: 4 und 2.'],
    'Untere Reihe: 5 – 1 – 3, obere Reihe: 4 – 2. Die 1 sitzt in der Mitte.');
  mc(AN, 2, 'Arbeitsanschlüsse', 'Welche Anschlüsse sind beim 5/2-Wegeventil die Arbeitsanschlüsse zum Zylinder?', V52(), ['2 und 4', '1 und 3', '3 und 5', '12 und 14'], 0,
    ['Arbeitsanschlüsse führen die Luft zum Verbraucher (Zylinder).', 'Es sind die geraden Zahlen im oberen Teil des Symbols.', '2 und 4 gehen zu den beiden Zylinderkammern.'],
    '2 und 4 sind Arbeitsanschlüsse. 3 entlüftet 2, 5 entlüftet 4.');
  mc(AN, 2, 'Steueranschluss 14', 'Bei einem Signal an Steueranschluss 14 strömt die Druckluft von Anschluss 1 zu …', V52({ s14: 'pilot' }), ['Anschluss 4', 'Anschluss 2', 'Anschluss 3', 'Anschluss 5'], 0,
    ['Die Zehnerstelle des Steueranschlusses nennt den Anschluss, der mit Druck verbunden wird: 14 = 1 → 4.', 'Bei 14 wird 1 mit 4 verbunden, bei 12 wird 1 mit 2 verbunden.', 'Signal an 14: 1 nach 4. (2 wird dabei über 3 entlüftet.)'],
    'Die Steueranschluss-Nummer verrät, welche Verbindung entsteht: 14 steht für 1→4, 12 für 1→2. Das Ventil schaltet in diese Stellung.');
  tap(AN, 2, 'Steueranschluss 12', 'Tippe auf den Steueranschluss, der bei Druck die Verbindung 1 nach 2 herstellt.', V52({ s14: 'pilot', s12: 'pilot' }), ['12'],
    ['Die Steueranschlüsse liegen links und rechts am Symbol.', 'Gesucht ist die Zahl, die für 1 → 2 steht.', 'Der Anschluss 12 liegt rechts am Impulsventil.'],
    '12 schaltet 1 → 2, 14 schaltet 1 → 4.');

  /* --- Schaltplan lesen */
  const lesen = (level, title, text, cir, goal, mcq, tips, expl) => T.push({ cat: LE, level, title, type: 'lesen', text, cir, goal, mcq, tips, expl });
  lesen(1, 'Zylinder per Taster bewegen', 'Öffne die Schaltung, drücke den Taster 1S1 (gedrückt halten), bis der Zylinder ganz ausgefahren ist, und lass ihn dann los. Tippe danach auf „Prüfen“.', 'ea_dk', { cnt: { z1: { out: 1, in: 1 } } }, null,
    ['Tippe auf das Ventil 1S1 und halte den Finger oder die Maus gedrückt. Beobachte die Farben der Leitungen.', 'Blau bedeutet Druck. Warte, bis der Zylinder die vordere Endlage erreicht hat, und lass erst dann los.', 'Taster halten, bis der Kolben vorn ist, loslassen, bis er wieder ganz hinten ist. Dann „Prüfen“.'],
    'Beim Drücken schaltet das Ventil 1 nach 2 durch, der Zylinder wird belüftet und fährt aus. Beim Loslassen entlüftet 2 über 3 und die Feder fährt den Kolben zurück.');
  lesen(2, 'Impulsventil: Speicherverhalten', 'Fahre den Zylinder mit 1S1 aus (kurz drücken). Lass den Taster los: Der Zylinder soll ausgefahren bleiben. Fahre ihn danach mit 1S2 wieder ein. Tippe dann auf „Prüfen“.', 'imp', { cnt: { z1: { out: 1, in: 1 } }, hold: 'z1' }, null,
    ['Das Impulsventil hat keine Feder. Was passiert, wenn das Steuersignal wieder verschwindet?', 'Ein kurzer Druck genügt. Beobachte, dass die Stellung von 1V1 nach dem Loslassen bleibt.', '1S1 kurz tippen, Zylinder fährt aus und bleibt draußen. Dann 1S2 kurz tippen, Zylinder fährt ein.'],
    'Das Impulsventil merkt sich seine letzte Stellung (Speicher): Ein Impuls an 14 schaltet auf Ausfahren, erst ein Impuls an 12 schaltet zurück.');
  lesen(2, 'Zweihandschaltung', 'Teste die Schaltung: Wann fährt der Zylinder aus?', 'und', null,
    { q: 'Unter welcher Bedingung fährt der Zylinder aus?', opts: ['Nur wenn 1S1 und 1S2 gleichzeitig gedrückt sind', 'Wenn 1S1 oder 1S2 gedrückt ist', 'Nur wenn 1S1 gedrückt ist', 'Immer, sobald Druckluft anliegt'], ans: 0 },
    ['Probiere alle Kombinationen der beiden Taster aus. Zum gleichzeitigen Drücken gibt es unten den Schalter „Taster rasten“.', 'Drücke zuerst nur einen Taster, dann nur den anderen, dann beide.', 'Nur mit beiden Tastern entsteht am Ausgang des Zweidruckventils Druck.'],
    'Das Zweidruckventil (UND) lässt nur dann Druck zum Ausgang, wenn beide Eingänge Druck haben.');
  lesen(2, 'Abluftdrosselung', 'Schau dir die Schaltung an und fahre den Zylinder aus und ein.', 'lang',
    null, { q: 'Wie wird die Ausfahrgeschwindigkeit eingestellt?', opts: ['Das Drossel-Rückschlagventil bremst die Abluft der Stangenseite beim Ausfahren', 'Das 5/2-Ventil bremst die Zuluft beim Ausfahren', 'Die Wartungseinheit regelt die Geschwindigkeit', 'Der Schalldämpfer bremst die Zuluft'], ans: 0 },
    ['Vergleiche, wie schnell der Zylinder aus- und wie schnell er einfährt.', 'Beim Ausfahren muss die Luft der Stangenseite entweichen. Welches Bauteil sitzt in dieser Leitung?', 'Das Drossel-Rückschlagventil sitzt an der Stangenseite. Beim Ausfahren ist es in Drosselrichtung durchströmt.'],
    'Abluftdrosselung: Die Abluft des Zylinders wird gedrosselt. Der Kolben fährt dadurch langsam und gleichmäßig, weil er gegen ein Luftpolster arbeitet.');
  lesen(3, 'Endlagen-Signale', 'Starte die Schaltung mit dem Handhebel 1S1 (Taster rasten einschalten) und beobachte die Rollenhebelventile.', 'hinher', null,
    { q: 'Wozu dienen die beiden Rollenhebelventile 1B1 und 1B2?', opts: ['Sie erkennen die Endlagen des Kolbens und schalten das Impulsventil um', 'Sie begrenzen den Druck im Zylinder', 'Sie starten die Anlage von Hand', 'Sie drosseln die Kolbengeschwindigkeit'], ans: 0 },
    ['Schau, welches Rollenhebelventil gerade betätigt wird, wenn der Kolben ganz hinten oder ganz vorn ist.', 'Das Signal der Rollenhebelventile geht an die Steueranschlüsse 14 und 12 des Impulsventils.', 'Jede Endlage erzeugt ein Signal. Das Impulsventil schaltet daraufhin die Bewegungsrichtung um.'],
    'Rollenhebelventile sind Endlagen-Signalgeber: Die Kolbenstange betätigt sie in der jeweiligen Endlage und die Steuerung reagiert darauf.');

  /* --- Verschlauchen */
  const verschl = (level, title, text, cir, tips, expl) => T.push({ cat: VE, level, title, type: 'verschl', text, cir, tips, expl });
  verschl(1, 'Einfachwirkenden Zylinder ansteuern', 'Verschlauche die Anlage: Der einfachwirkende Zylinder soll ausfahren, solange der Taster gedrückt ist, und beim Loslassen zurückfahren.', 'ea_dk',
    ['Verfolge den Weg der Druckluft: Quelle → Wartungseinheit → Ventil → Zylinder.', 'Das Ventil bekommt Druck an Anschluss 1 und gibt ihn bei Betätigung an Anschluss 2 weiter.', 'Wartungseinheit an 1S1 Anschluss 1, 1S1 Anschluss 2 an den Zylinder.'],
    'Druckluft geht von der Wartungseinheit an Anschluss 1 des Ventils. Der Arbeitsanschluss 2 führt zum Zylinder. Die Entlüftung 3 bleibt offen, darüber entlüftet der Zylinder beim Loslassen.');
  verschl(1, 'Doppeltwirkenden Zylinder ansteuern', 'Verschlauche die Anlage: Der doppeltwirkende Zylinder soll ausfahren, solange der Taster gedrückt ist, und sonst eingefahren bleiben.', 'da_52',
    ['Das 5/2-Ventil hat zwei Arbeitsanschlüsse. Jeder führt zu einer Zylinderkammer.', 'Ausfahren heißt: Druck auf die Kolbenseite K. Betätigt verbindet das Ventil 1 mit 4.', 'Wartungseinheit an 1, Anschluss 4 an K (Kolbenseite), Anschluss 2 an S (Stangenseite).'],
    'In Ruhe liegt Druck über 1 → 2 an der Stangenseite: Zylinder bleibt eingefahren. Betätigt: 1 → 4 an der Kolbenseite, der Zylinder fährt aus.');
  verschl(2, 'Indirekte Ansteuerung', 'Der Taster 1S1 soll nur das Hauptventil 1V1 (5/2) über Steuerluft schalten. Verschlauche so, dass der Zylinder beim Drücken von 1S1 ausfährt und beim Loslassen einfährt.', 'indirekt',
    ['Zwei Ventile brauchen beide Druckluft. Wohin geht das Signal von 1S1?', 'Das Ausgangssignal von 1S1 (Anschluss 2) wird zum Steueranschluss des Hauptventils geführt.', '1S1.1 und 1V1.1 an die Wartungseinheit, 1S1.2 an 1V1.14, 1V1.4 an K, 1V1.2 an S.'],
    'Indirekte Steuerung: Die kleine Steuerluft von 1S1 schaltet das Hauptventil. So kann ein kleiner Taster einen großen Zylinder steuern. Die Feder in 1V1 stellt zurück, wenn 14 entlüftet ist.');
  verschl(2, 'Zweihandschaltung (UND)', 'Der Zylinder darf nur ausfahren, wenn beide Taster 1S1 und 1S2 gedrückt sind. Verschlauche die Anlage mit dem Zweidruckventil.', 'und',
    ['Beide Signale müssen am Zweidruckventil ankommen. Es ist die UND-Verknüpfung.', 'Jedes Taster-Ventil bekommt Druck an 1; seine Ausgänge gehen an die Eingänge des Zweidruckventils.', 'Beide Taster-Ausgänge 2 an die Eingänge des Zweidruckventils, dessen Ausgang 2 an den Zylinder.'],
    'Das Zweidruckventil gibt nur dann Druck zum Ausgang, wenn an beiden Eingängen Druck steht. So kann der Zylinder nicht ausfahren, solange eine Hand frei ist.');
  verschl(2, 'ODER-Bedienung', 'Der Zylinder soll ausfahren, wenn 1S1 oder 1S2 (oder beide) gedrückt wird. Verschlauche die Anlage mit dem Wechselventil.', 'oder',
    ['Zwei Taster, eine Aufgabe: Das Wechselventil führt beide Signale zusammen.', 'Zwei Leitungen einfach zusammenzuhängen funktioniert nicht, weil Druckluft über das andere Ventil entweichen würde.', 'Taster-Ausgänge an die Eingänge des Wechselventils, dessen Ausgang an den Zylinder.'],
    'Das Wechselventil (ODER) schaltet den Eingang mit Druck zum Ausgang durch. Die Kugel sperrt dabei den anderen Eingang, damit die Luft nicht über das unbetätigte Taster-Ventil entweicht.');
  verschl(2, 'Langsam ausfahren', 'Der Zylinder soll beim Ausfahren langsam fahren, beim Einfahren aber schnell. Setze das Drossel-Rückschlagventil richtig ein.', 'lang',
    ['Beim Ausfahren muss die Luft der Stangenseite aus dem Zylinder entweichen. Dort drosselst du.', 'Das Drossel-Rückschlagventil gehört an den Anschluss der Stangenseite S: Zylinderseite an Z, Ventilseite an V.', 'Anschluss 2 des Ventils an V des Drosselventils, Z des Drosselventils an die Stangenseite S, Anschluss 4 direkt an K.'],
    'Abluftdrosselung: Beim Ausfahren wird die Luft der Stangenseite gedrosselt, beim Einfahren umgeht sie die Drossel über das Rückschlagventil und der Rückhub ist schnell.');
  verschl(3, 'Selbsthaltung mit Impulsventil', 'Ein kurzer Druck auf 1S1 soll den Zylinder ausfahren lassen, und er bleibt ausgefahren. Erst ein kurzer Druck auf 1S2 fährt ihn wieder ein. Verschlauche die Anlage.', 'imp',
    ['Das Impulsventil hat keine Feder. Es braucht für jede Richtung einen eigenen Steuerimpuls.', 'Ausfahren (Druck an K) schaltet 14, Einfahren schaltet 12. Das Impulsventil braucht außerdem selbst Druck an 1.', 'Wartungseinheit an 1S1.1, 1S2.1 und 1V1.1; 1S1.2 an 14, 1S2.2 an 12; 4 an K, 2 an S.'],
    'Das Impulsventil speichert seine Stellung. Es genügt ein kurzer Impuls: Die Luft an 14 schaltet auf Ausfahren, der Impuls an 12 zurück. Das ist die einfachste Speicherfunktion (Selbsthaltung) in der Pneumatik.');
  verschl(3, 'Selbsttätiger Rückhub', 'Nach einem kurzen Druck auf 1S1 soll der Zylinder ausfahren und in der vorderen Endlage selbsttätig wieder einfahren. Verschlauche die Anlage mit dem Rollenhebelventil 1B2.', 'autoruck',
    ['Die vordere Endlage meldet das Rollenhebelventil 1B2. Es braucht Druck an Anschluss 1.', 'Das Signal von 1B2 muss das Ventil auf „Einfahren“ umschalten. Welcher Steueranschluss gehört dazu?', 'Wartungseinheit an 1S1.1, 1B2.1 und 1V1.1; 1S1.2 an 14, 1B2.2 an 12; 4 an K, 2 an S.'],
    'Der Rollenhebel 1B2 wird von der Kolbenstange in der vorderen Endlage betätigt und gibt ein Signal an 12 des Impulsventils. So fährt der Zylinder ohne weiteren Tastendruck zurück.');
  verschl(3, 'Hin- und Herfahren', 'Der Zylinder soll nach dem Einschalten mit dem Handhebel 1S1 selbsttätig hin- und herfahren. Verschlauche die Anlage mit den Endlagen-Rollenhebeln 1B1 (hinten) und 1B2 (vorn).', 'hinher',
    ['Beide Rollenhebel bekommen ihre Druckluft vom Handhebel 1S1. So stoppt die Anlage, wenn er ausgeschaltet wird.', '1B1 (hinten) soll Ausfahren auslösen, 1B2 (vorn) Einfahren. Welcher Steueranschluss gehört zu welcher Richtung?', 'Wartungseinheit an 1V1.1 und 1S1.1; 1S1.2 an 1B1.1 und 1B2.1; 1B1.2 an 14, 1B2.2 an 12; 4 an K, 2 an S.'],
    'In der hinteren Endlage gibt 1B1 den Impuls für Ausfahren, in der vorderen 1B2 den für Einfahren. Solange 1S1 eingeschaltet ist, wiederholt sich das. Beim Ausschalten bleibt der Zylinder in einer Endlage stehen.');

  /* --- Kraft und Luftverbrauch */
  const num = (level, title, text, unit, ans, tips, expl, steps) => T.push({ cat: KR, level, title, type: 'num', text, unit, ans, tol: 0.02, tips, expl, steps });
  const C = CORE.calc;
  const f27 = C.kraftAus(6, 40), f29 = C.kraftEin(6, 50, 20), p30 = C.druckFuerKraft(900, 40), v31 = C.luftHub(6, 50, 200), f32 = C.kraftNutz(C.kraftAus(6, 63), 0.15);
  num(1, 'Kolbenkraft beim Ausfahren', 'Ein doppeltwirkender Zylinder hat einen Kolbendurchmesser von 40 mm und wird mit 6 bar betrieben. Wie groß ist die theoretische Kolbenkraft beim Ausfahren?', 'N', f27,
    ['Die Kraft ergibt sich aus Druck mal Fläche: F = p · A.', 'Kolbenfläche A = π/4 · d². Rechne den Druck um: 1 bar = 0,1 N/mm².', 'A = π/4 · 40² = 1256,6 mm²;  F = 0,6 N/mm² · 1256,6 mm² ≈ 754 N.'],
    'F = p · A mit A = π/4 · d². Bei 6 bar (0,6 N/mm²) und 40 mm Kolbendurchmesser ergibt sich etwa 754 N. Reibung ist darin noch nicht berücksichtigt.', ['A = π/4 · d² = ' + fm(C.flaeche(40), 1) + ' mm²', 'F = p · A = 0,6 N/mm² · ' + fm(C.flaeche(40), 1) + ' mm² = ' + fm(f27, 0) + ' N']);
  num(1, 'Kolbengeschwindigkeit', 'Ein Zylinder fährt 200 mm Hub in 1,6 s aus. Wie groß ist die mittlere Kolbengeschwindigkeit in mm/s?', 'mm/s', C.geschw(200, 1.6),
    ['Geschwindigkeit = Weg geteilt durch Zeit.', 'v = s / t mit s = 200 mm und t = 1,6 s.', 'v = 200 mm / 1,6 s = 125 mm/s (das sind 0,125 m/s).'],
    'v = s / t. Der Hub ist der Weg, die Ausfahrzeit die Zeit. 125 mm/s entsprechen 0,125 m/s.', ['v = s / t = 200 mm / 1,6 s = 125 mm/s']);
  num(2, 'Kolbenkraft beim Einfahren', 'Ein Zylinder hat 50 mm Kolbendurchmesser und 20 mm Kolbenstangendurchmesser, Betriebsdruck 6 bar. Wie groß ist die theoretische Kraft beim Einfahren?', 'N', f29,
    ['Beim Einfahren wirkt der Druck auf die Ringfläche: Die Kolbenstange nimmt Fläche weg.', 'A_Ring = π/4 · (D² − d²) mit D = 50 mm, d = 20 mm.', 'A_Ring = π/4 · (2500 − 400) = 1649,3 mm²;  F = 0,6 N/mm² · 1649,3 mm² ≈ 990 N.'],
    'Die wirksame Fläche beim Einfahren ist kleiner als beim Ausfahren, weil die Kolbenstange Platz braucht. Deshalb ist die Einfahrkraft kleiner (hier etwa 990 N statt 1178 N).', ['A_Ring = π/4 · (D² − d²) = ' + fm(C.flaecheRing(50, 20), 1) + ' mm²', 'F = p · A_Ring = 0,6 N/mm² · ' + fm(C.flaecheRing(50, 20), 1) + ' mm² = ' + fm(f29, 0) + ' N']);
  num(2, 'Erforderlicher Druck', 'Ein Zylinder mit 40 mm Kolbendurchmesser soll beim Ausfahren theoretisch 900 N Kraft aufbringen. Welcher Druck ist dafür mindestens nötig? (Angabe in bar)', 'bar', p30,
    ['Stelle die Formel F = p · A nach dem Druck um.', 'p = F / A, die Fläche A = π/4 · d² in mm². Das Ergebnis in N/mm² mal 10 ergibt bar.', 'A = 1256,6 mm²;  p = 900 N / 1256,6 mm² = 0,716 N/mm² ≈ 7,2 bar.'],
    'p = F / A. 0,716 N/mm² sind 7,16 bar. Dazu kommen noch Reibungsverluste, in der Praxis braucht man also noch mehr Druck oder einen größeren Zylinder.', ['p = F / A = 900 N / ' + fm(C.flaeche(40), 1) + ' mm² = ' + fm(p30 / 10, 3) + ' N/mm² = ' + fm(p30, 2) + ' bar']);
  num(3, 'Luftverbrauch je Ausfahrhub', 'Ein Zylinder (Kolbendurchmesser 50 mm, Hub 200 mm) arbeitet mit 6 bar Überdruck. Wie viel Luft (angesaugter Zustand, Normliter) verbraucht ein Ausfahrhub? Rechne vereinfacht mit 1 bar Atmosphärendruck.', 'l', v31,
    ['Verbrauch = Hubvolumen mal Druckverhältnis. Absolutdruck = Überdruck + 1 bar.', 'Hubvolumen V = A · s in mm³ (1 Liter = 1 000 000 mm³). Druckverhältnis (6 + 1) / 1 = 7.', 'A = 1963,5 mm²; V = 1963,5 · 200 = 392 700 mm³ = 0,3927 l;  Verbrauch = 0,3927 l · 7 ≈ 2,75 l.'],
    'Die Druckluft ist verdichtet. Ein Liter Hubvolumen bei 6 bar Überdruck entspricht etwa 7 Litern angesaugter Luft. Dieser Richtwert genügt für die Abschätzung des Luftverbrauchs.', ['A = ' + fm(C.flaeche(50), 1) + ' mm²', 'V = A · s = ' + fm(C.flaeche(50) * 200, 0) + ' mm³ = ' + fm(C.flaeche(50) * 200 / 1e6, 4) + ' l', 'Verbrauch = V · (p + 1) = ' + fm(v31, 2) + ' l']);
  num(3, 'Nutzkraft mit Reibung', 'Ein Zylinder (Kolbendurchmesser 63 mm) wird mit 6 bar betrieben. Rechne mit einem Reibungsverlust von 15 % (Richtwert: 10 bis 20 %). Wie groß ist die Nutzkraft beim Ausfahren?', 'N', f32,
    ['Erst die theoretische Kraft F = p · A bestimmen, dann die Reibung abziehen.', 'F_theor = 0,6 N/mm² · π/4 · 63² mm². Nutzkraft = F_theor · (1 − 0,15).', 'F_theor ≈ 1870 N;  Nutzkraft ≈ 1870 N · 0,85 ≈ 1590 N.'],
    'Die Reibung der Dichtungen und Führungen verringert die Kraft. Ein Wirkungsgrad von etwa 80 bis 90 % ist ein üblicher Richtwert, für die genaue Auslegung zählen die Herstellerangaben.', ['F_theor = ' + fm(C.kraftAus(6, 63), 1) + ' N', 'Nutzkraft = F_theor · 0,85 = ' + fm(f32, 0) + ' N']);

  /* ---------------------------------------------------------------- Aufgaben aus dem Berufsschulstoff (Lernfeld Pneumatik); neue Aufgaben werden immer hinten angehängt, damit die Nummern der bisherigen Aufgaben gleich bleiben.
     PRUEFEN Pn: Fragen an den Ausbilder stehen in quelle/pne/PRUEFEN.md */
  /* PRUEFEN P2 */
  mc(DL, 1, 'Druckluft erzeugen', 'Ein einstufiger Kolbenverdichter liefert die Druckluft. Was geschieht, wenn sich der Kolben vom oberen zum unteren Totpunkt bewegt?', null,
    ['Das Volumen im Zylinder wird kleiner, die Luft wird verdichtet', 'Die Druckluft wird über das Auslassventil in den Druckbehälter gedrückt', 'Das Volumen wird größer, über das Einlassventil strömt Umgebungsluft nach', 'Beide Ventile bleiben offen, damit sich der Druck ausgleicht'], 2,
    ['Stell dir den Kolben im Zylinder vor: Beim Weg nach unten wird der Raum über dem Kolben größer.', 'Ein größer werdender Raum saugt Luft an. Welches Ventil lässt Luft von außen herein?', 'Abwärts saugt der Kolben über das Einlassventil an. Erst beim Weg nach oben wird die Luft verdichtet und das Auslassventil öffnet.'],
    'Beim Weg zum unteren Totpunkt vergrößert sich das Volumen, der Druck im Zylinder sinkt und Umgebungsluft strömt über das Einlassventil nach. Beim Weg zum oberen Totpunkt schließt das Einlassventil, das Volumen wird kleiner, der Druck steigt, und bei genügend hohem Druck öffnet das Auslassventil zum Druckbehälter.');
  /* PRUEFEN P3 */
  mc(DL, 1, 'Druckluft als Energieträger', 'Welche Aussage über Druckluft als Energieträger ist richtig?', null,
    ['Druckluft lässt sich nicht speichern, sie muss sofort verbraucht werden', 'Wegen der geringen Verluste hat Druckluft den besten Wirkungsgrad aller Energieträger', 'Druckluft lässt sich ohne Verluste über viele Kilometer durch dünne Rohre leiten', 'Der übliche Arbeitsdruck beträgt rund 6 bar, in der Hydraulik ist er deutlich höher'], 3,
    ['Drei Aussagen versprechen etwas, das Druckluft nicht hält: unbegrenzte Reichweite, bestes Ergebnis, keine Speicherung.', 'Druckluft wird verdichtet, strömt durch Leitungen und dehnt sich aus. Dabei entstehen Verluste. Welche Zahl nennt man für den Druck in der Werkstatt?', 'Rund 6 bar sind der übliche Arbeitsdruck. Hydrauliköl arbeitet mit deutlich höherem Druck, dafür ist die Luft im Druckbehälter speicherbar.'],
    'Druckluft arbeitet üblicherweise mit rund 6 bar, die Hydraulik mit einem Vielfachen davon. Druckluft lässt sich in einem Druckbehälter speichern, aber Verdichten und Strömen kosten Energie: Der Wirkungsgrad ist vergleichsweise gering, und die Reichweite im Rohrnetz ist begrenzt.');
  /* PRUEFEN P4 */
  mc(DL, 2, 'Wann kein Öler?', 'Hinter dem Filter und dem Druckregler kann ein Öler sitzen. In welchem Fall darf die Druckluft nicht geölt werden?', null,
    ['Wenn der Zylinder einen Kolbendurchmesser von mehr als 50 mm hat und deshalb viel Luft braucht', 'Wenn die Abluft Lebensmittel oder frischen Lack berühren kann oder die Bauteile dauergeschmiert sind', 'Wenn der Betriebsdruck unter 6 bar liegt, weil das Öl dann nicht mehr zerstäubt wird', 'Wenn nur einfachwirkende Zylinder angeschlossen sind, da diese ohne Schmierung auskommen'], 1,
    ['Öl in der Abluft gelangt in die Umgebung und kann Produkte verunreinigen.', 'Es geht um die Frage: Verträgt die Anwendung ölhaltige Abluft, und sind die Bauteile dauergeschmiert?', 'Lebensmittel, Medizin und Lackierarbeiten verlangen ölfreie Luft. Bauteile, die ab Werk dauergeschmiert sind, brauchen kein Öl. Mit Druck oder Zylindergröße hat es nichts zu tun.'],
    'Wo Abluft mit Lebensmitteln, Medikamenten oder frischem Lack in Berührung kommt, darf kein Öl in der Luft sein. Auch für dauergeschmierte Bauteile ist kein Öler nötig. Merke: Wurde eine Anlage einmal mit Öl betrieben, ist das Erstfett der Bauteile ausgewaschen, und sie muss dauerhaft weiter geölt werden.');
  /* PRUEFEN P5 */
  mc(SY, 1, 'Pfeil und T im Ventilsymbol', 'In den Feldern eines Wegeventil-Symbols stehen Pfeile und T-Striche. Was bedeuten sie?', V32(),
    ['Der Pfeil zeigt die Betätigungsrichtung des Tasters, das T den Anschluss für Steuerluft', 'Pfeil und T zeigen beide die Strömungsrichtung, nur in unterschiedlicher Stärke', 'Der Pfeil zeigt die Strömungsrichtung in dieser Stellung, das T einen gesperrten Anschluss', 'Der Pfeil kennzeichnet den Druckanschluss, das T den Anschluss der Entlüftung ins Freie'], 2,
    ['Jedes Feld zeigt, was das Ventil in einer Schaltstellung tut.', 'Ein Pfeil zeigt eine Bewegung, ein T zeigt eine Sperre. Was bewegt sich in einem Ventil?', 'Pfeil = Luft strömt in diese Richtung. T = hier ist der Anschluss in dieser Stellung verschlossen.'],
    'Im Ventilsymbol zeigt jedes Feld eine Schaltstellung. Ein Pfeil gibt die Strömungsrichtung der Druckluft in dieser Stellung an, ein T (Querstrich) bedeutet: Der Anschluss ist in dieser Stellung gesperrt.');
  mc(SY, 2, 'Dreieck an der Entlüftung', 'Das Symbol zeigt eine Entlüftung. Was bedeutet das Dreieck an den Anschlüssen 3 und 5 eines Wegeventils?', { t: 'sd' },
    ['Hier wird Druckluft aus dem Netz zugeführt', 'Die verbrauchte Luft strömt ins Freie ab', 'Der Anschluss ist dauerhaft fest verschlossen', 'Hier sitzt der Filter der Wartungseinheit'], 1,
    ['Die Anschlüsse 3 und 5 sind die Anschlüsse, über die ein Zylinder entlüftet wird.', 'Was geschieht mit der Luft, die aus dem Zylinder herausgedrückt wird? Sie muss irgendwohin.', 'Die Abluft darf über 3 und 5 ins Freie entweichen. Das Dreieck steht für die Entlüftung (meist mit Schalldämpfer).'],
    'Das Dreieck an 3 und 5 bedeutet: Abluft strömt ins Freie. Über diese Anschlüsse wird der Zylinder entlüftet, damit er zurückfahren kann. Meist sitzt ein Schalldämpfer davor.');
  /* PRUEFEN P6 */
  const f38 = C.kraftAus(5, 50) - 60;
  num(2, 'Kraft beim einfachwirkenden Zylinder', 'Ein einfachwirkender Zylinder mit 50 mm Kolbendurchmesser wird mit 5 bar betrieben. Die Rückstellfeder wirkt beim Ausfahren mit 60 N dagegen. Reibung bleibt unberücksichtigt. Wie groß ist die Kraft an der Kolbenstange beim Ausfahren?', 'N', f38,
    ['Die Druckkraft ist F = p · A. Die Feder arbeitet dagegen.', 'Erst die theoretische Kraft aus Druck und Kolbenfläche (5 bar = 0,5 N/mm²), dann die Federkraft abziehen.', 'A = π/4 · 50² = 1963,5 mm²; F = 0,5 N/mm² · 1963,5 mm² = 981,7 N; davon 60 N Federkraft abziehen: etwa 922 N.'],
    'Beim einfachwirkenden Zylinder muss die Druckkraft die Feder zusammendrücken. Die Kraft an der Kolbenstange ist deshalb kleiner als die reine Druckkraft: Von etwa 981,7 N bleiben nach Abzug der 60 N Federkraft etwa 922 N.', ['A = π/4 · d² = ' + fm(C.flaeche(50), 1) + ' mm²', 'F_theor = p · A = 0,5 N/mm² · ' + fm(C.flaeche(50), 1) + ' mm² = ' + fm(C.kraftAus(5, 50), 1) + ' N', 'F = F_theor − F_Feder = ' + fm(C.kraftAus(5, 50), 1) + ' N − 60 N = ' + fm(f38, 1) + ' N']);
  /* PRUEFEN P1 */
  lesen(2, 'Presse: Not-Aus und Endlage', 'Öffne die Presse. Drücke beide Taster 1S1 und 1S2 (Schalter „Taster rasten“ benutzen, danach wieder loslassen) und beobachte, wie der Stempel ausfährt. Drücke dann während des Ausfahrens den Not-Aus 0S1 und beobachte, was geschieht.', 'presse', null,
    { q: 'Welche Aufgabe hat das Wechselventil 1V4 in dieser Presse?', opts: ['Es verknüpft beide Taster, damit der Stempel nur bei zwei Händen ausfährt', 'Es verknüpft Rollenhebel und Not-Aus: Eines von beiden löst den Rückhub aus', 'Es bremst die Abluft der Stangenseite und stellt so die Geschwindigkeit ein', 'Es speichert den Startimpuls der Taster, bis der Stempel vorn ist'], ans: 1 },
    ['Verfolge die Leitung zum Steueranschluss 12 des Impulsventils: Welche Ventile liefern dorthin ihr Signal?', 'An 12 ankommen soll das Signal von zwei verschiedenen Stellen. Beide dürfen unabhängig voneinander einfahren lassen. Welche Verknüpfung ist das?', 'Der Rollenhebel 1B2 meldet die vordere Endlage, der Not-Aus 0S1 den Notfall. Das Wechselventil (ODER) lässt beide den Rückhub auslösen.'],
    'Der Rückhub wird über Anschluss 12 des Impulsventils ausgelöst. Das Wechselventil (ODER) gibt Druck an 12, sobald der Rollenhebel in der vorderen Endlage oder der Not-Aus betätigt ist. Das Zweidruckventil 1V3 (UND) macht dagegen den Start von beiden Tastern abhängig.');
  verschl(3, 'Presse mit Zweihandstart und Not-Aus', 'Die Presse soll nur ausfahren, wenn beide Taster 1S1 und 1S2 gedrückt sind. Der Stempel soll langsam ausfahren. Er soll zurückfahren, sobald die vordere Endlage erreicht ist (und beide Taster losgelassen sind) oder wenn der Not-Aus 0S1 betätigt wird. Verschlauche die Anlage.', 'presse',
    ['Zerlege die Aufgabe: Start (UND), Geschwindigkeit (Drossel), Rückhub (ODER aus Endlage und Not-Aus). Jede Teilaufgabe braucht ihr Ventil.', 'Das Impulsventil 1V1 bekommt Druck an 1, Startsignal an 14 und Rückhubsignal an 12. Alle Signalventile (Taster, Rollenhebel, Not-Aus) brauchen Druck an Anschluss 1.', 'Wartungseinheit an 1S1.1, 1S2.1, 1B2.1, 0S1.1 und 1V1.1. 1S1.2 und 1S2.2 an 1V3, 1V3.2 an 1V1.14. 1B2.2 und 0S1.2 an 1V4, 1V4.2 an 1V1.12. 1V1.4 an K, 1V1.2 an 1V2.V, 1V2.Z an S.'],
    'Zweihandstart: Das Zweidruckventil 1V3 lässt nur Druck an 14, wenn beide Taster gedrückt sind. Der Rückhub: Das Wechselventil 1V4 verknüpft Endlage 1B2 und Not-Aus 0S1 mit ODER, damit eines genügt. Die Drossel 1V2 in der Abluft der Stangenseite bremst das Ausfahren, beim Einfahren umgeht die Luft sie über das Rückschlagventil.');

  /* ---------------------------------------------------------------- Weitere Aufgaben aus dem Berufsschulstoff (pne41 bis pne44: Presse, Energieträger, Zylinder auslegen); hinten angehängt, Nummern der bisherigen bleiben. */
  /* PRUEFEN P7 */
  lesen(3, 'Presse: eine Hand geht vom Taster', 'Öffne die Presse. Drücke beide Taster 1S1 und 1S2 (Schalter „Taster rasten“), und lass einen der beiden Taster los, während der Stempel noch ausfährt. Beobachte den Stempel und das Impulsventil 1V1.', 'presse', null,
    { q: 'Was geschieht in dieser Übungsschaltung, wenn während des Ausfahrens ein Taster losgelassen wird?', opts: ['Der Stempel bleibt sofort stehen, weil das Zweidruckventil den Zylinder entlüftet', 'Der Stempel fährt sofort zurück, weil das Wechselventil auf Rückhub umschaltet', 'Der Stempel fährt weiter bis vorn, weil das Impulsventil seine Stellung behält', 'Der Stempel fährt langsamer weiter, weil die Drossel den Querschnitt verkleinert'], ans: 2 },
    ['Verfolge, wohin das Signal des Zweidruckventils führt. Was passiert mit dem Ventil 1V1, wenn dieses Signal verschwindet?', '1V1 ist ein Impulsventil ohne Feder. Es schaltet nur um, wenn an 12 oder 14 ein neues Signal kommt.', 'Das Signal an 14 verschwindet, 1V1 bleibt aber in seiner Stellung. Der Stempel fährt bis zur vorderen Endlage, erst 1B2 oder der Not-Aus lösen den Rückhub aus.'],
    'Das Zweidruckventil gibt nur ein Startsignal an 14. Das Impulsventil 1V1 speichert seine Stellung, deshalb fährt der Stempel auch nach dem Loslassen weiter, bis 1B2 oder der Not-Aus über das Wechselventil an 12 den Rückhub auslösen. An einer echten Presse wäre das nicht zulässig: Eine Zweihandschaltung muss die gefährliche Bewegung beenden, sobald eine Hand den Taster loslässt. Dafür wird dort ein Ventil mit Federrückstellung oder eine sichere Steuerung eingesetzt.');
  /* PRUEFEN P8 */
  mc(DL, 2, 'Energieträger für eine Presse wählen', 'Eine Presse soll auf kleinem Raum eine Kraft von 150 kN aufbringen und diese Kraft feinfühlig halten. Welcher Energieträger eignet sich dafür am besten?', null,
    ['Pneumatik, weil Druckluft mit rund 6 bar sehr große Kräfte liefert', 'Hydraulik, weil das Öl mit einem Druck von einigen hundert bar arbeitet', 'Pneumatik, weil die zusammendrückbare Luft die Kraft genau hält', 'Elektrischer Antrieb ohne Getriebe, weil er direkt große Kräfte erzeugt'], 1,
    ['Rechne grob nach, wie groß ein Druckluftzylinder für 150 kN bei 6 bar sein müsste: A = F : p.', 'Bei 6 bar (0,6 N/mm²) bräuchte der Kolben rund 250 000 mm² Fläche. Mit welchem Medium wird der Zylinder kleiner?', 'Hydrauliköl ist kaum zusammendrückbar und arbeitet mit sehr hohem Druck. Bei 200 bar reicht ein Kolben von knapp 100 mm Durchmesser.'],
    'Bei 6 bar (0,6 N/mm²) müsste der Kolben für 150 kN eine Fläche von 250 000 mm² haben, das ist ein Durchmesser von etwa 564 mm. Bei 200 bar (20 N/mm²) Hydraulikdruck genügen 7 500 mm², also etwa 98 mm Durchmesser. Außerdem ist Öl fast nicht zusammendrückbar, die Kraft lässt sich gut halten und dosieren. Druckluft ist dagegen zusammendrückbar und gibt nach.');
  /* PRUEFEN P9 */
  const d43 = Math.sqrt(4 * (1500 / 0.9) / 0.6 / Math.PI);
  num(3, 'Kolbendurchmesser auswählen', 'Ein Zylinder soll beim Ausfahren eine Nutzkraft von 1500 N aufbringen. Der Betriebsdruck beträgt 6 bar, wegen der Reibung rechnest du mit einem Wirkungsgrad von 90 %. Wie groß muss der Kolbendurchmesser mindestens sein? (Angabe in mm)', 'mm', d43,
    ['Die Reibung kostet Kraft: Der Zylinder muss theoretisch mehr Kraft liefern, als an der Stange gebraucht wird.', 'Theoretische Kraft = Nutzkraft : 0,9. Fläche A = F : p mit p = 0,6 N/mm². Danach A = π/4 · d² nach d umstellen.', 'F = 1500 N : 0,9 = 1666,7 N; A = 1666,7 N : 0,6 N/mm² = 2777,8 mm²; d = Wurzel(4 · A : π) ≈ 59,5 mm.'],
    'Theoretische Kraft F = 1500 N : 0,9 = 1666,7 N. Nötige Kolbenfläche A = F : p = 1666,7 N : 0,6 N/mm² = 2777,8 mm². Aus A = π/4 · d² folgt d = Wurzel(4 · A : π) ≈ 59,5 mm. Gewählt wird der nächstgrößere genormte Kolbendurchmesser, zum Beispiel 63 mm.',
    ['F_theor = 1500 N : 0,9 = ' + fm(1500 / 0.9, 1) + ' N', 'A = F : p = ' + fm(1500 / 0.9, 1) + ' N : 0,6 N/mm² = ' + fm(1500 / 0.9 / 0.6, 1) + ' mm²', 'd = Wurzel(4 · A : π) = ' + fm(d43, 1) + ' mm']);
  /* PRUEFEN P10 */
  const vA44 = C.flaeche(50) * 100 / 1e6, vR44 = C.flaecheRing(50, 20) * 100 / 1e6, q44 = (vA44 + vR44) * 7 * 12;
  num(3, 'Luftverbrauch je Minute', 'Ein doppeltwirkender Zylinder (Kolbendurchmesser 50 mm, Kolbenstange 20 mm, Hub 100 mm) wird mit 6 bar Überdruck betrieben und fährt 12-mal je Minute aus und wieder ein. Wie viel Luft (angesaugter Zustand) verbraucht er je Minute? Rechne vereinfacht mit 1 bar Atmosphärendruck. (Angabe in Liter je Minute)', 'l/min', q44,
    ['Ein Doppelhub besteht aus Ausfahren und Einfahren. Beim Einfahren wird nur die Ringfläche gefüllt.', 'Hubvolumen aus = π/4 · D² · s, Hubvolumen ein = π/4 · (D² − d²) · s. Die Summe mal (6 + 1) ergibt die angesaugte Luft je Doppelhub.', 'Volumen je Doppelhub ≈ 0,196 l + 0,165 l = 0,361 l; mal 7 ≈ 2,53 l; mal 12 Doppelhübe ≈ 30,3 l/min.'],
    'Ausfahren: π/4 · 50² · 100 mm³ ≈ 0,196 l. Einfahren (Ringfläche): π/4 · (50² − 20²) · 100 mm³ ≈ 0,165 l. Je Doppelhub sind das 0,361 l Zylindervolumen. Bei 6 bar Überdruck ist die Luft auf das 7-Fache verdichtet: 0,361 l · 7 ≈ 2,53 l angesaugte Luft. Bei 12 Doppelhüben je Minute: 2,53 l · 12 ≈ 30,3 l/min. Mit diesem Wert wählt man zum Beispiel den Verdichter aus.',
    ['V_aus = ' + fm(vA44, 4) + ' l, V_ein = ' + fm(vR44, 4) + ' l', 'je Doppelhub: (' + fm(vA44, 4) + ' + ' + fm(vR44, 4) + ') l · 7 = ' + fm((vA44 + vR44) * 7, 3) + ' l', 'je Minute: ' + fm((vA44 + vR44) * 7, 3) + ' l · 12 = ' + fm(q44, 1) + ' l/min']);


  /* ---------------------------------------------------------------- Neue Aufgaben pne45 bis pne55 (Industriemechaniker: Steuerungstechnik Pneumatik); hinten angehängt, Nummern der bisherigen bleiben. PRUEFEN P11 bis P21: quelle/pne/PRUEFEN.md */
  /* PRUEFEN P11 */
  mc(SY, 1, 'Handhebel mit Rastung', 'Ein 5/2-Wegeventil mit Handhebel und Rastung wird auf „ausfahren“ gestellt. Danach lässt du den Hebel los. Was geschieht?', null,
    ['Das Ventil federt sofort zurück und der Zylinder fährt wieder ein', 'Das Ventil bleibt in der gewählten Stellung und der Zylinder bleibt ausgefahren', 'Das Ventil entlüftet beide Zylinderseiten und der Kolben bleibt stehen', 'Das Ventil schaltet nach kurzer Zeit von selbst in die Grundstellung zurück'], 1,
    ['Das Wort Rastung sagt, was der Hebel tut: Er rastet ein.', 'Ein Ventil mit Federrückstellung kehrt zurück, ein Ventil mit Rastung nicht.', 'Das Ventil bleibt so lange in der Stellung, bis du den Hebel von Hand zurückstellst.'],
    'Bei einem Handhebel mit Rastung bleibt das Ventil in der Stellung, in die du es gebracht hast. Erst eine neue Handbetätigung schaltet es zurück. Das Ventil hat damit ein Speicherverhalten wie ein Impulsventil. Mit Federrückstellung würde es dagegen beim Loslassen in die Grundstellung zurückkehren.');
  /* PRUEFEN P12 */
  mc(SY, 3, '5/3-Ventil in Mittelstellung', 'Ein doppeltwirkender Zylinder wird über ein 5/3-Wegeventil mit gesperrter Mittelstellung angesteuert. Der Kolben soll mitten im Hub anhalten, du schaltest das Ventil in die Mittelstellung. Was ist zu erwarten?', null,
    ['Der Kolben bleibt stehen, kann bei äußerer Last aber etwas nachgeben, weil die eingeschlossene Luft zusammendrückbar ist', 'Der Kolben bleibt unter allen Umständen starr stehen, weil Druckluft in einer Kammer nicht nachgeben kann', 'Der Kolben fährt langsam in die Endlage, weil die Luft über die Entlüftung der Kammern entweichen kann', 'Der Kolben pendelt zwischen den Endlagen weiter, weil die Mittelstellung keine Absperrung bietet'], 0,
    ['Überlege, welche Anschlüsse das Ventil in der gesperrten Mittelstellung offen lässt.', 'Beide Zylinderkammern sind abgesperrt. Wie verhält sich die eingeschlossene Luft, wenn eine Kraft von außen wirkt?', 'Luft lässt sich zusammendrücken. Deshalb ist der Kolben nicht so starr wie bei Hydrauliköl.'],
    'In der gesperrten Mittelstellung sind alle Anschlüsse des Ventils abgesperrt. Der Kolben hält an, weil die Luft in beiden Kammern eingeschlossen ist. Da Luft zusammendrückbar ist, gibt der Kolben aber nach, wenn von außen eine Kraft wirkt. Eine genaue Positionierung ist so nicht möglich, dafür braucht man Hydraulik, Bremsen oder eine Lageregelung.');
  /* PRUEFEN P13 */
  mc(LE, 3, 'Wechselventil: Sperrwirkung', 'Ein Zylinder kann von zwei Tastern aus gestartet werden, die Signale laufen in ein Wechselventil (ODER). Du betätigst nur den Taster 1S1, der Taster 1S2 bleibt unbetätigt und ist an seiner Entlüftung offen. Warum entweicht die Luft nicht über 1S2 ins Freie?', null,
    ['Das Ventil 1S2 hat eine Feder, die seinen Ausgang auch bei offener Entlüftung dicht hält', 'Die Luft bleibt vor dem Wechselventil stehen, bis auch der Taster 1S2 betätigt wird', 'Das Wechselventil sperrt den unbetätigten Eingang und leitet die Luft zum Ausgang', 'Ein Schalldämpfer an der Entlüftung von 1S2 verschließt die Leitung von selbst'], 2,
    ['Das Wechselventil hat zwei Eingänge und einen Ausgang. Im Inneren liegt ein beweglicher Körper.', 'Der bewegliche Körper wird von der Seite mit dem höheren Druck gegen den anderen Eingang gedrückt.', 'Der Druck von 1S1 schiebt den Körper vor den Eingang von 1S2 und sperrt ihn.'],
    'Im Wechselventil sitzt ein beweglicher Körper (Kugel oder Kolben). Der Druck von der belüfteten Seite drückt ihn auf den gegenüberliegenden Eingang und sperrt ihn ab. Die Luft kann nur zum Ausgang strömen und geht nicht über das unbetätigte Ventil verloren. Fällt der Druck von 1S1 weg und kommt er von 1S2, wechselt der Körper die Seite.');
  /* PRUEFEN P14 */
  mc(LE, 2, 'Kurzschreibweise der Schrittfolge', 'Eine Anlage mit den Zylindern A und B wird mit der Schrittfolge „A+ B+ B− A−“ beschrieben. Das Pluszeichen steht für Ausfahren, das Minuszeichen für Einfahren. In welcher Reihenfolge laufen die Bewegungen ab?', null,
    ['A und B fahren gleichzeitig aus und danach gleichzeitig wieder ein', 'A fährt aus, A fährt ein, B fährt aus, B fährt ein', 'B fährt aus, A fährt aus, A fährt ein, B fährt ein', 'A fährt aus, B fährt aus, B fährt ein, A fährt ein'], 3,
    ['Lies die Schrittfolge von links nach rechts: Jeder Eintrag ist ein Schritt.', 'Der Buchstabe nennt den Zylinder, das Zeichen die Bewegungsrichtung.', 'Die vier Schritte lauten: A aus, B aus, B ein, A ein.'],
    'Die Kurzschreibweise nennt die Schritte nacheinander: A+ heißt Zylinder A fährt aus, B+ Zylinder B fährt aus, B− B fährt wieder ein und A− A fährt wieder ein. Es läuft immer ein Schritt nach dem anderen ab. Der Zylinder, der zuerst ausgefahren ist, fährt zuletzt wieder ein.');
  /* PRUEFEN P15 */
  mc(LE, 3, 'Zustand nach Schritt 3', 'Die Schrittfolge einer Anlage lautet A+ B+ A− B− (Schritt 1 bis 4). Zu Beginn sind beide Zylinder eingefahren. Welchen Zustand haben die Zylinder nach Schritt 3?', null,
    ['A ausgefahren, B ausgefahren', 'A ausgefahren, B eingefahren', 'A eingefahren, B eingefahren', 'A eingefahren, B ausgefahren'], 3,
    ['Gehe die Schritte einzeln durch und notiere nach jedem Schritt die Stellung von A und B.', 'Nach Schritt 1 ist A aus, nach Schritt 2 sind A und B aus. Was ändert Schritt 3?', 'Schritt 3 ist A−: A fährt wieder ein, B bleibt ausgefahren, denn B− folgt erst in Schritt 4.'],
    'Start: A ein, B ein. Schritt 1 (A+): A aus, B ein. Schritt 2 (B+): A aus, B aus. Schritt 3 (A−): A ein, B aus. Schritt 4 (B−): A ein, B ein. Nach Schritt 3 ist A also eingefahren und B noch ausgefahren. Ein Weg-Schritt-Diagramm zeigt genau diese Stellungen für jeden Schritt als Linien.');
  /* PRUEFEN P16 */
  mc(SY, 2, 'Endlagendämpfung', 'Ein Zylinder mit großer Last schlägt am Hubende hart an. Er soll eine einstellbare Endlagendämpfung bekommen. Wie wirkt sie?', null,
    ['Die Dämpfung verkürzt den Hub, sodass der Kolben gar nicht mehr an den Deckel stößt', 'Der Zylinder wird kurz vor der Endlage zusätzlich belüftet und fährt schneller hinein', 'Kurz vor der Endlage wird die Abluft eingeengt, der Kolben bremst gegen ein Luftpolster ab', 'Eine Feder drückt dauernd gegen den Kolben und hält ihn in der Mitte des Hubs'], 2,
    ['Die Dämpfung wirkt erst kurz vor dem Hubende, nicht über den ganzen Hub.', 'Der Kolben muss die Luft vor sich herausdrücken. Was passiert, wenn dafür nur ein kleiner Querschnitt frei ist?', 'Die eingeschlossene Restluft kann nur über eine einstellbare Drossel entweichen und bildet ein Polster.'],
    'Kurz vor der Endlage taucht ein Dämpfungskolben in eine Bohrung ein. Die Luft vor dem Kolben kann nur noch über eine einstellbare Drossel entweichen. Es entsteht ein Luftpolster, das den Kolben abbremst. So wird der harte Anschlag und damit Lärm und Verschleiß vermieden.');
  /* PRUEFEN P17 */
  mc(DL, 1, 'Kondensat ablassen', 'Unten in der Filterschale der Wartungseinheit hat sich Flüssigkeit gesammelt. Was ist die richtige Maßnahme?', null,
    ['Die Flüssigkeit stehen lassen, sie bleibt in der Schale und schadet nicht', 'Das Kondensat regelmäßig ablassen oder einen automatischen Kondensatablass einbauen', 'Die Schale mit Öl füllen, damit das Wasser nach oben verdrängt wird', 'Den Druckregler höher einstellen, damit die Flüssigkeit durch die Leitung gedrückt wird'], 1,
    ['Das Wasser stammt aus der Luft, die im Verdichter komprimiert wurde.', 'Wohin würde das Wasser gelangen, wenn die Schale ganz voll ist?', 'Die Schale hat unten einen Ablass. Dort wird das Kondensat abgelassen.'],
    'Das Wasser aus der Druckluft sammelt sich als Kondensat in der Filterschale. Ist die Schale voll, reißt die Strömung das Wasser mit in die Steuerung und die Ventile. Deshalb wird das Kondensat regelmäßig abgelassen, oder ein automatischer Kondensatablass übernimmt das.');
  /* PRUEFEN P18 */
  mc(DL, 2, 'Druckregler einstellen', 'Im Druckluftnetz stehen 8 bar an. Die Anlage soll mit 6 bar arbeiten. Wie stellst du den Druckregler der Wartungseinheit ein?', null,
    ['Am Regler wird am Manometer auf 6 bar eingestellt, der Netzdruck muss dafür mindestens so hoch sein', 'Der Regler erhöht den Druck, deshalb stellst du ihn auf 14 bar, damit 6 bar übrig bleiben', 'Am Regler lässt sich nur der Durchfluss einstellen, nicht der Druck hinter dem Regler', 'Der Druck wird allein am Verdichter eingestellt, der Regler kann ihn nur anzeigen'], 0,
    ['Ein Druckminderer kann den Druck senken, aber nicht über den Eingangsdruck erhöhen.', 'Hinter dem Regler sitzt ein Manometer. Es zeigt den eingestellten Ausgangsdruck.', 'Den Druck hinter dem Regler stellst du mit dem Drehknopf ein, bis das Manometer 6 bar zeigt.'],
    'Der Druckregler arbeitet als Druckminderer: Er hält den Druck hinter dem Regler auf dem eingestellten Wert, solange der Eingangsdruck höher ist. Am Drehknopf wird der Ausgangsdruck eingestellt und am Manometer abgelesen, hier 6 bar. Einen höheren Druck als den Netzdruck kann der Regler nicht liefern.');
  /* PRUEFEN P19 */
  mc(DL, 2, 'Nachkühler hinter dem Verdichter', 'Hinter einem Kolbenverdichter sitzt ein Nachkühler mit Wasserabscheider. Welche Aufgabe hat er?', null,
    ['Er erwärmt die Druckluft weiter, damit der Wasserdampf vollständig verdunstet', 'Er erhöht den Druck der Luft auf das Doppelte, bevor sie in den Behälter strömt', 'Er schmiert die Luft mit einem feinen Ölnebel, damit die Zylinder geschmiert sind', 'Er kühlt die heiße Luft ab, wobei viel Wasser als Kondensat ausfällt'], 3,
    ['Beim Verdichten wird die Luft heiß. Warme Luft kann viel Wasserdampf aufnehmen.', 'Was passiert mit dem Wasserdampf, wenn die Luft abkühlt?', 'Abgekühlte Luft kann weniger Wasserdampf halten. Der Rest schlägt sich als Wasser nieder.'],
    'Verdichtete Luft ist heiß und enthält viel Wasserdampf. Im Nachkühler kühlt sie ab. Weil kältere Luft weniger Wasserdampf aufnehmen kann, kondensiert ein großer Teil des Wassers und wird im Wasserabscheider abgelassen. Die Druckluft wird dadurch trockener und belastet die nachfolgenden Bauteile weniger.');
  /* PRUEFEN P20 */
  const dd54 = 32, dk54 = 12, hub54 = 80, n54 = 10, zl54 = 3, zu54 = 1.2;
  const vz54 = C.luftHub(6, dd54, hub54, dk54, 'zyklus'), q54 = vz54 * n54 * zl54 * zu54;
  num(3, 'Luftverbrauch einer Anlage', 'Drei gleiche doppeltwirkende Zylinder (Kolbendurchmesser 32 mm, Kolbenstange 12 mm, Hub 80 mm) arbeiten mit 6 bar Überdruck, jeder fährt 10-mal je Minute aus und wieder ein. Für Leckage in den Leitungen rechnest du mit einem Zuschlag von 20 %. Welchen Luftstrom (angesaugte Luft, Atmosphärendruck vereinfacht 1 bar) muss die Druckluftversorgung mindestens liefern? (Angabe in Liter je Minute)', 'l/min', q54,
    ['Rechne zuerst die Luftmenge für einen Doppelhub eines Zylinders: Ausfahren mit der Kolbenfläche, Einfahren mit der Ringfläche.', 'Mit dem Faktor (6 + 1) wird die verdichtete Luft auf angesaugte Luft umgerechnet. Dann mal Doppelhübe je Minute, mal Zahl der Zylinder, mal 1,2.', 'Je Doppelhub etwa 0,84 l angesaugte Luft; mal 10 Doppelhübe und 3 Zylinder; dann der Zuschlag von 20 %.'],
    'Ausfahren: π/4 · 32² · 80 mm³ ≈ 0,0643 l, Einfahren (Ringfläche): π/4 · (32² − 12²) · 80 mm³ ≈ 0,0553 l. Je Doppelhub sind das 0,1196 l Zylindervolumen, bei 6 bar Überdruck mal 7: 0,837 l angesaugte Luft. Je Minute 10 Doppelhübe, 3 Zylinder und 20 % Zuschlag ergeben etwa 30,1 l/min. Mit diesem Wert wird die Druckluftversorgung (Verdichter, Leitungen) ausgelegt.',
    ['V je Doppelhub = ' + fm(vz54, 3) + ' l (angesaugt, schon mal 7)', 'ohne Zuschlag: ' + fm(vz54, 3) + ' l · 10 · 3 = ' + fm(vz54 * n54 * zl54, 2) + ' l/min', 'mit 20 % Zuschlag: ' + fm(vz54 * n54 * zl54, 2) + ' l/min · 1,2 = ' + fm(q54, 1) + ' l/min']);
  /* PRUEFEN P21 */
  mc(DL, 1, 'Aufgabe des Druckluftbehälters', 'Hinter dem Verdichter einer Werkstatt steht ein Druckluftbehälter. Welche Aufgabe hat er?', null,
    ['Er speichert Druckluft, gleicht Schwankungen aus und entlastet den Verdichter', 'Er erzeugt den Druck, indem er die Luft im Behälter weiter zusammenpresst', 'Er filtert feinste Schmutzteilchen aus der Luft und ersetzt den Filter der Wartungseinheit', 'Er mischt der Luft Öl für die Schmierung der Zylinder bei und kühlt sie dabei'], 0,
    ['Der Verbrauch in der Werkstatt schwankt, der Verdichter läuft aber nicht immer gleich.', 'Was geschieht, wenn viele Zylinder gleichzeitig Luft brauchen?', 'Der Behälter ist ein Vorrat, der Spitzen abfängt.'],
    'Der Druckluftbehälter ist ein Speicher: Er puffert Verbrauchsspitzen und Druckschwankungen im Netz ab. Der Verdichter muss dadurch nicht bei jedem kurzen Verbrauch einschalten, seine Schaltspiele werden weniger. Außerdem kühlt die Luft im Behälter ab und ein Teil des Wassers fällt aus.');

  T.forEach((t, i) => { t.id = 'pne' + (i + 1); if (t.cir) t.cirObj = CIRCUITS[t.cir]; });
  const TASKS = {}; T.forEach(t => { TASKS[t.id] = t; });

  /* Beispiele (Reiter "Beispiele", Aufruf ?bsp): alle fertigen Schaltungen aus "Schaltpläne" mit den ersten zwei Sätzen ihrer Beschreibung. */
  const sentences = (s, n) => (String(s).match(/[^.!?]+[.!?]+(?:\s|$)/g) || [String(s)]).slice(0, n).join('').trim();
  const BEISPIELE = Object.keys(CIRCUITS).map(id => ({ id, cir: id, titel: CIRCUITS[id].title, text: sentences(CIRCUITS[id].desc, 2) }));
  const DATA = { geom, partName, partDesc, SYMS, CIRCUITS, TASKS, LIST: T, CATS, NAMES, BEISPIELE };
  root.PNE_DATA = DATA;
  root.PNE_TASKS = T.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
