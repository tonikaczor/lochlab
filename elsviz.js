'use strict';
/* Tonfunk Sicherheits-Lab: Visualisierungen (Lab-Kennung 'els'), window.ELS_VIZ, per Node testbar (module.exports).
   Reine SVG-Funktionen plus eine kleine DOM-Anbindung, die ohne Änderung an elsui.js auskommt (liest nur ELS_UI.S und die Felder der Auslegung):
   - Prüfstand "Netzform und Fehlerschleife": Karte "Fehlerstrompfad" mit Leiterfarben (L braun, N blau, PE grün-gelb). Der Pfad des Fehlerstroms
     leuchtet bei Körperschluss (TN-S, TN-C-S, TT über Erdreich, IT: nur kleiner Kapazitätsstrom, erster Fehler ohne Abschaltung).
     Bei unterbrochenem Schutzleiter ist der Rückweg unterbrochen (Zeichen X).
   - Reiter "Auslegen": Schritt 2 Aderquerschnitt im Größenverhältnis (3-adrige Leitung: L braun, N blau, PE grün-gelb),
     Schritt 3 Bauteilform des gewählten Schutzorgans (LS-Schalter mit Auslösecharakteristik, Schraubsicherung mit Kennmelder)
     und der Fehlerstrompfad der gewählten Netzform, Schritt 4 Bauform des RCD.
   Aufgabenintegrität: Nichts erscheint, solange eine Aufgabe läuft (ELS_UI.S.task) oder der Prüfmodus an ist; der Aufgaben-Reiter (#taskView),
   Trainer und Lösungen werden nicht berührt. Die Bilder zeigen nur Normwissen und die Einstellung des Nutzers, keine Ergebnisse.
   Farben nur über CSS-Variablen, Ausnahme: die normierten Leiterfarben und Materialtöne (Kupfer, Keramik). Keine Animation. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : (d || 0);
  const p1 = v => fin(v).toFixed(1);
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : NaN; };

  /* Normierte Leiterfarben (DIN VDE 0293-308): L1 braun, L2 schwarz, L3 grau, N blau, PE grün-gelb */
  const WIRE = { L1: '#8a5a2b', L2: '#1c1c1c', L3: '#9a9a9a', N: '#2f7de1', PEg: '#3fa75a', PEy: '#e8d84a' };
  const FORMS = ['TN-S', 'TN-C-S', 'TT', 'IT'];
  const FORMTXT = {
    'TN-S': 'TN-S: Der Schutzleiter PE läuft getrennt vom Neutralleiter N bis zum Sternpunkt der Quelle zurück. Der Fehlerstrom ist groß, das Schutzorgan schaltet schnell ab.',
    'TN-C-S': 'TN-C-S: Auf dem ersten Stück führt ein gemeinsamer PEN-Leiter beide Aufgaben, hinter der Aufteilung laufen PE und N getrennt. Der Pfad ist wie im TN-S.',
    'TT': 'TT: Das Gehäuse hat einen eigenen Erder R_A, die Quelle hat den Betriebserder R_B. Der Fehlerstrom fließt durch das Erdreich; er ist klein, deshalb ist ein RCD nötig.',
    'IT': 'IT: Die Quelle ist nicht oder nur hochohmig geerdet. Beim ersten Fehler fließt nur ein kleiner Strom über die Leitungskapazität: Die Anlage läuft weiter, die Isolationsüberwachung meldet.'
  };

  /* ---------- Hilfen: Leitungen in Normfarbe, Erdsymbol, Widerstand ---------- */
  const wire = (d, col, w) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const wireOutline = (d, col, w) => `<path d="${d}" fill="none" stroke="var(--line)" stroke-width="${(w || 3) + 1.6}" stroke-linecap="round" stroke-linejoin="round"/>` + wire(d, col, w);
  const wirePE = d => wireOutline(d, WIRE.PEg, 3.4) + `<path d="${d}" fill="none" stroke="${WIRE.PEy}" stroke-width="3.4" stroke-dasharray="6 6" stroke-linecap="butt" stroke-linejoin="round"/>`;
  const wirePEN = d => wireOutline(d, WIRE.N, 3.4) + `<path d="${d}" fill="none" stroke="${WIRE.PEy}" stroke-width="3.4" stroke-dasharray="6 6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${WIRE.PEg}" stroke-width="3.4" stroke-dasharray="6 6" stroke-dashoffset="6" stroke-linejoin="round"/>`;
  const earth = (x, y) => `<path d="M${x} ${y}v6M${x - 9} ${y + 6}h18M${x - 6} ${y + 10}h12M${x - 3} ${y + 14}h6" fill="none" stroke="var(--fg)" stroke-width="1.6" stroke-linecap="round"/>`;
  const resBox = (x, y, label, right) => `<rect x="${x - 5}" y="${y}" width="10" height="18" rx="1.5" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.4"/><text class="es-s" x="${right ? x + 10 : x - 10}" y="${y + 13}" text-anchor="${right ? 'start' : 'end'}">${label}</text>`;
  const txt = (x, y, t, cls, an) => `<text class="${cls || 'es-s'}" x="${p1(x)}" y="${p1(y)}"${an ? ` text-anchor="${an}"` : ''}>${esc(t)}</text>`;

  /* ---------- Fehlerstrompfad ---------- */
  /* o: { form, fault (Körperschluss ist aktiv), peBroken (Schutzleiter unterbrochen) } */
  function pfadSvg(o) {
    o = o || {}; const form = FORMS.indexOf(o.form) >= 0 ? o.form : 'TN-S', on = !!o.fault, pb = !!o.peBroken && (form === 'TN-S' || form === 'TN-C-S');
    const W = 360, H = (o.form === 'TT' || o.form === 'IT') ? 196 : 172, X0 = 44, XG = 250, YL = 34, YN = 50, YP = 142, YE = 172;
    let s = `<rect class="es-bg" width="${W}" height="${H}" rx="8"/>`;
    /* Pfad des Fehlerstroms (Lage der Leitungen), Glow unter den Leitungen */
    let path;
    if (form === 'TN-S' || form === 'TN-C-S') path = `M${X0} 104V${YL}H${XG}V112V${YP}H${X0}Z`;
    else path = `M${X0} 104V${YL}H${XG}V112V${YE}H${X0}Z`;
    const glow = on && !pb && form !== 'IT';
    if (glow) s += `<path d="${path}" fill="none" stroke="var(--danger)" stroke-width="10" stroke-opacity=".38" stroke-linejoin="round"/>`;
    if (on && form === 'IT') s += `<path d="M${XG} 112V${YE}H${X0}V104" fill="none" stroke="var(--warn)" stroke-width="6" stroke-opacity=".35" stroke-dasharray="2 6" stroke-linecap="round"/>`;
    /* Quelle */
    s += `<circle cx="${X0}" cy="64" r="15" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.6"/><circle cx="${X0}" cy="88" r="15" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.6"/>`;
    s += txt(X0 + 22, 102, 'Quelle', 'es-s');
    /* Leitungen */
    s += wireOutline(`M${X0} 50V${YL}H${XG}V62`, WIRE.L1, 3.4);
    if (form === 'TN-C-S') s += wireOutline(`M150 ${YP}V${YN}H300V62`, WIRE.N, 3.4);
    else if (form !== 'IT') s += wireOutline(`M${X0 + 10} 78V${YN}H300V62`, WIRE.N, 3.4);
    s += txt(X0 + 14, YL - 5, 'L (braun)', 'es-s');
    if (form !== 'IT') s += txt(form === 'TN-C-S' ? 160 : 100, YN + 15, 'N (blau)', 'es-s');
    /* Gerät mit Gehäuse */
    s += `<rect x="${XG - 36}" y="62" width="122" height="50" rx="6" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2.4"/>`;
    s += txt(XG + 25, 84, 'Gerät', 'es-t', 'middle') + txt(XG + 25, 100, 'Gehäuse', 'es-s', 'middle');
    /* Körperschluss */
    s += `<path d="M${XG} 62l-4 8 8 6-8 6 4 6" fill="none" stroke="${on ? 'var(--danger)' : 'var(--mute)'}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (on) s += txt(XG - 10, 78, 'Körperschluss', 'es-s on', 'end');
    /* Schutzleiter / Erde je Netzform */
    if (form === 'TN-S' || form === 'TN-C-S') {
      const d = `M${XG} 112V${YP}H${X0}V104`;
      if (form === 'TN-C-S') s += wirePEN(`M150 ${YP}H${X0}V104`) + wirePE(`M${XG} 112V${YP}H150`) + `<circle cx="150" cy="${YP}" r="3.4" fill="var(--fg)"/>` + txt(X0 + 30, YP + 16, 'PEN', 'es-s') + txt(156, YP + 16, 'PE (grün-gelb)', 'es-s') + txt(150, YP + 30, 'Aufteilung in PE und N', 'es-s', 'middle');
      else s += wirePE(d) + txt(100, YP + 16, 'PE (grün-gelb)', 'es-s');
      s += earth(X0 + 10, YP);
      if (pb) s += `<path d="M${XG - 6} ${YP - 14}l12 12m0 -12l-12 12" stroke="var(--danger)" stroke-width="3" stroke-linecap="round"/>` + txt(XG - 12, YP - 20, 'PE unterbrochen', 'es-s on', 'end');
    } else if (form === 'TT') {
      s += wireOutline(`M${XG} 112V128`, WIRE.PEg, 3.4) + resBox(XG, 128, 'R_A', true) + wireOutline(`M${XG} 146V${YE - 6}`, WIRE.PEg, 3.4);
      s += wireOutline(`M${X0} 104V128`, WIRE.PEg, 3.4) + resBox(X0, 128, 'R_B', true) + wireOutline(`M${X0} 146V${YE - 6}`, WIRE.PEg, 3.4);
      s += `<path d="M${X0} ${YE}H${XG}" stroke="var(--mute)" stroke-width="1.6" stroke-dasharray="4 4"/>` + txt((X0 + XG) / 2, YE + 15, 'Erdreich', 'es-s', 'middle');
    } else {
      s += wireOutline(`M${XG} 112V128`, WIRE.PEg, 3.4) + resBox(XG, 128, 'Erder', true) + wireOutline(`M${XG} 146V${YE - 6}`, WIRE.PEg, 3.4);
      s += wireOutline(`M${X0} 104V122`, WIRE.PEg, 2.4) + `<rect x="${X0 - 20}" y="122" width="40" height="22" rx="3" fill="var(--panel2)" stroke="var(--fg)" stroke-width="1.4"/>` + txt(X0, 137, 'IMD', 'es-s', 'middle') + wireOutline(`M${X0} 144V${YE - 6}`, WIRE.PEg, 2.4);
      s += `<path d="M${X0} ${YE}H${XG}" stroke="var(--mute)" stroke-width="1.6" stroke-dasharray="4 4"/>` + txt((X0 + XG) / 2, YE + 15, 'Erdreich, Leitungskapazität', 'es-s', 'middle');
    }
    s += txt(X0 - 24, 20, form, 'es-t');
    const state = on ? (pb ? 'Fehlerstrompfad unterbrochen' : form === 'IT' ? 'nur kleiner Kapazitätsstrom' : 'Fehlerstrompfad leuchtet') : 'ohne Körperschluss';
    return `<svg viewBox="0 0 ${W} ${H + 10}" role="img" aria-label="Fehlerstrompfad im ${esc(form)}-System, ${esc(state)}">${s}</svg>`;
  }
  /* Farbleiste der Adern */
  function farbleiste() {
    const chip = (name, col, extra) => `<span class="es-ch"><i style="background:${col}${extra || ''}"></i>${name}</span>`;
    return '<div class="es-leg">' + chip('L1 braun', WIRE.L1) + chip('L2 schwarz', WIRE.L2) + chip('L3 grau', WIRE.L3) + chip('N blau', WIRE.N) +
      `<span class="es-ch"><i style="background:repeating-linear-gradient(90deg,${WIRE.PEg} 0 5px,${WIRE.PEy} 5px 10px)"></i>PE grün-gelb</span></div>`;
  }

  /* ---------- Aderquerschnitt: dreiadrige Leitung ---------- */
  const QN = [1.5, 2.5, 4, 6];
  function aderSvg(q) {
    const A = num(q); if (!(A > 0)) return `<svg viewBox="0 0 360 40" role="img" aria-label="Aderquerschnitt"><text class="es-t" x="180" y="24" text-anchor="middle">Kein Querschnitt gewählt.</text></svg>`;
    const K = 9, cu = a => K * Math.sqrt(a / Math.PI), INS = 3.4, W = 360, H = 150;
    const r = cu(A), ro = r + INS, d = 2 * ro + 1.5, cx = 70, cy = 78;
    /* drei Adern im Dreieck, Mantel außen */
    const pts = [[cx - d / 2, cy + d * 0.29], [cx + d / 2, cy + d * 0.29], [cx, cy - d * 0.58]];
    const cols = [['PE', 'pe'], ['N', WIRE.N], ['L', WIRE.L1]];
    const sheath = d * 0.58 + ro + 4;
    let s = `<rect class="es-bg" width="${W}" height="${H}" rx="8"/>`;
    s += `<circle cx="${cx}" cy="${p1(cy)}" r="${p1(sheath)}" fill="var(--line)" stroke="var(--mute)" stroke-width="1"/>`;
    pts.forEach((p, i) => {
      const c = cols[i][1];
      if (c === 'pe') s += `<circle cx="${p1(p[0])}" cy="${p1(p[1])}" r="${p1(ro)}" fill="${WIRE.PEg}"/><path d="M${p1(p[0] - ro)} ${p1(p[1])}a${p1(ro)} ${p1(ro)} 0 0 1 ${p1(2 * ro)} 0z" fill="${WIRE.PEy}"/>`;
      else s += `<circle cx="${p1(p[0])}" cy="${p1(p[1])}" r="${p1(ro)}" fill="${c}"/>`;
      s += `<circle class="es-cu" cx="${p1(p[0])}" cy="${p1(p[1])}" r="${p1(r)}"/>`;
    });
    s += txt(cx, 140, `3 × ${String(A).replace('.', ',')} mm²`, 'es-t', 'middle');
    s += txt(144, 24, 'Aderquerschnitt im Größenvergleich', 'es-s');
    let x = 144; const by = 72;
    QN.forEach(a => {
      const rr = cu(a), on = Math.abs(a - A) < 1e-9;
      s += `<circle class="es-cu${on ? ' on' : ''}" cx="${p1(x + rr)}" cy="${by}" r="${p1(rr)}"${on ? '' : ' fill-opacity=".55"'}/>` + txt(x + rr, by + 36, String(a).replace('.', ','), on ? 'es-s on' : 'es-s', 'middle');
      x += 2 * rr + 8;
    });
    s += txt(144, 128, 'Kupfer der Ader, Fläche = Querschnitt', 'es-s');
    s += txt(144, 142, 'Leitung: L braun, N blau, PE grün-gelb', 'es-s');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Querschnitt einer dreiadrigen Leitung mit ${String(A).replace('.', ',')} Quadratmillimeter je Ader: Außenleiter braun, Neutralleiter blau, Schutzleiter grün-gelb">${s}</svg>`;
  }

  /* ---------- Bauteilformen ---------- */
  const LSCH = { B: { t: 'B', mag: '3 bis 5' }, C: { t: 'C', mag: '5 bis 10' }, D: { t: 'D', mag: '10 bis 20' } };
  function lsSvg(typ, inn) {
    const c = LSCH[typ]; if (!c) return '';
    const W = 360, H = 190, x = 40, y = 14, w = 66, h = 150;
    let s = `<rect class="es-bg" width="${W}" height="${H}" rx="8"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>`;
    s += `<rect x="${x + 8}" y="${y - 6}" width="${w - 16}" height="10" rx="2" fill="var(--mute)"/><rect x="${x + 8}" y="${y + h - 4}" width="${w - 16}" height="10" rx="2" fill="var(--mute)"/>`;
    s += `<rect x="${x + 17}" y="${y + 18}" width="${w - 34}" height="38" rx="4" fill="var(--line)"/><rect x="${x + 20}" y="${y + 20}" width="${w - 40}" height="18" rx="3" fill="var(--fg)"/>` + txt(x + w / 2, y + 52, 'I', 'es-s', 'middle');
    s += txt(x + w / 2, y + 90, `${c.t}${inn}`, 'es-big', 'middle') + txt(x + w / 2, y + 112, `${inn} A`, 'es-s', 'middle');
    s += txt(x + w / 2, y + 136, '1 TE', 'es-s', 'middle');
    s += txt(130, 34, 'Leitungsschutzschalter', 'es-t') + txt(130, 54, `Charakteristik ${c.t}`, 'es-s') + txt(130, 74, `Magnet löst bei ${c.mag} · In`, 'es-s');
    s += txt(130, 94, 'thermisch: Bimetall bei Überlast', 'es-s') + txt(130, 114, 'Hebel: Ein und Aus', 'es-s') + txt(130, 134, 'Breite: 1 Teilungseinheit (18 mm)', 'es-s');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Leitungsschutzschalter ${c.t} ${inn} Ampere: Magnetauslöser bei ${c.mag} mal Nennstrom">${s}</svg>`;
  }
  /* Kennfarben der Schraubsicherungen (Kennmelder), DIN 49515 */
  const KENN = { 2: ['rosa', '#f0a6c0'], 4: ['braun', '#8a5a2b'], 6: ['grün', '#3fa75a'], 10: ['rot', '#d83a3a'], 16: ['grau', '#9a9a9a'], 20: ['blau', '#2f7de1'], 25: ['gelb', '#e8d84a'], 35: ['schwarz', '#1c1c1c'], 50: ['weiß', '#f2f2f2'], 63: ['kupfer', '#c9763a'] };
  function sicherungSvg(inn) {
    const n = num(inn); if (!(n > 0)) return '';
    const k = KENN[n], W = 360, H = 170, kc = k ? k[1] : 'var(--line)';
    const neoKl = n <= 16 ? ['D01', 'E14', 22] : ['D02', 'E18', 28], diKl = n <= 25 ? ['D II', 'E27', 40] : ['D III', 'E33', 52];
    let s = `<rect class="es-bg" width="${W}" height="${H}" rx="8"/>`;
    const cart = (cx, w, name, gew) => {
      let g = `<rect x="${cx - w / 2}" y="34" width="${w}" height="88" rx="5" fill="#e9dcc4" stroke="var(--fg)" stroke-width="1.6"/>`;
      g += `<rect x="${cx - w / 2}" y="34" width="${w}" height="12" rx="3" fill="var(--mute)"/><rect x="${cx - w / 2}" y="112" width="${w}" height="10" rx="3" fill="var(--mute)"/>`;
      g += `<circle cx="${cx}" cy="76" r="${p1(Math.min(w / 2 - 3, 11))}" fill="${kc}" stroke="var(--fg)" stroke-width="1.4"/>`;
      g += txt(cx, 20, name, 'es-t', 'middle') + txt(cx, 142, gew, 'es-s', 'middle');
      return g;
    };
    s += cart(60, neoKl[2], 'Neozed ' + neoKl[0], neoKl[1]) + cart(150, diKl[2], 'Diazed ' + diKl[0], diKl[1]);
    s += txt(210, 34, 'Schmelzsicherung gG', 'es-t') + txt(210, 54, `Nennstrom ${n} A`, 'es-s') + txt(210, 74, k ? `Kennmelder: ${k[0]}` : 'Kennmelder: keine Farbe festgelegt', 'es-s');
    s += txt(210, 94, 'gG: Leitungsschutz', 'es-s') + txt(210, 114, 'Nach Auslösen tauschen', 'es-s');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schmelzsicherung gG ${n} Ampere: Neozed ${neoKl[0]} und Diazed ${diKl[0]}${k ? ', Kennmelder ' + k[0] : ''}">${s}</svg>`;
  }
  function rcdSvg(idn, typ) {
    const mA = num(idn); if (!(mA > 0)) return '';
    const W = 360, H = 190, x = 34, y = 14, w = 110, h = 150;
    let s = `<rect class="es-bg" width="${W}" height="${H}" rx="8"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/>`;
    s += `<rect x="${x + 10}" y="${y - 6}" width="${w - 20}" height="10" rx="2" fill="var(--mute)"/><rect x="${x + 10}" y="${y + h - 4}" width="${w - 20}" height="10" rx="2" fill="var(--mute)"/>`;
    s += `<rect x="${x + 14}" y="${y + 16}" width="${w - 68}" height="34" rx="4" fill="var(--line)"/><rect x="${x + 17}" y="${y + 18}" width="${w - 74}" height="16" rx="3" fill="var(--fg)"/>`;
    s += `<circle cx="${x + w - 24}" cy="${y + 33}" r="11" fill="var(--warn)" stroke="var(--fg)" stroke-width="1.4"/>` + txt(x + w - 24, y + 37, 'T', 'es-t', 'middle');
    s += txt(x + w / 2, y + 86, `${mA} mA`, 'es-big', 'middle') + txt(x + w / 2, y + 108, 'Typ ' + (typ || 'A'), 'es-t', 'middle') + txt(x + w / 2, y + 136, '2 TE', 'es-s', 'middle');
    s += txt(168, 34, 'Fehlerstrom-Schutzschalter (RCD)', 'es-t') + txt(168, 54, `Bemessungsdifferenzstrom ${mA} mA`, 'es-s') + txt(168, 74, 'Prüftaste T: monatlich drücken', 'es-s');
    s += txt(168, 94, 'Summenstromwandler: L und N', 'es-s') + txt(168, 114, 'Differenz = Fehlerstrom gegen Erde', 'es-s') + txt(168, 134, mA <= 30 ? 'Zusatzschutz bei direktem Berühren' : 'vor allem Brandschutz', 'es-s');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="RCD ${mA} Milliampere Typ ${esc(typ || 'A')} mit Prüftaste">${s}</svg>`;
  }

  /* ---------- DOM-Anbindung ---------- */
  const CSS = `
.es-t{fill:var(--fg);font:600 12px system-ui,sans-serif}.es-s{fill:var(--mute);font:11.5px system-ui,sans-serif}.es-s.on,.es-t.on{fill:var(--danger);font-weight:700}.es-big{fill:var(--fg);font:700 17px system-ui,sans-serif}
.es-bg{fill:var(--panel2)}.es-cu{fill:#c9763a;stroke:var(--line);stroke-width:.8}.es-cu.on{stroke:var(--fg);stroke-width:1.6}
.es-fig{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0;padding:4px 0}.es-fig svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
.es-note{font-size:13px;color:var(--mute);line-height:1.45;margin:6px 2px 0}.es-card{margin:8px 0}.es-cb{padding:2px 10px 10px}
.es-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--mute);margin:6px 2px 0}.es-ch{display:inline-flex;align-items:center;gap:5px}.es-ch i{display:inline-block;width:20px;height:10px;border-radius:3px;border:1px solid var(--line)}
`;
  function injectCss() { if (document.getElementById('elsviz-css')) return; const st = document.createElement('style'); st.id = 'elsviz-css'; st.textContent = CSS; document.head.appendChild(st); }
  const UI = () => root.ELS_UI;
  const examOn = () => { try { return localStorage.getItem('lm4.els.exam') === '1' || localStorage.getItem('els.exam') === '1'; } catch (e) { return false; } };
  const quiet = S => !S || S.task || examOn();
  function pfadTick() {
    const U = UI(), meters = document.getElementById('meters'); if (!U || !U.S || !meters) return;
    const S = U.S; let card = document.getElementById('esPfad');
    if (S.rigId !== 'netz' || S.tab !== 'rig' || quiet(S)) { if (card) card.hidden = true; return; }
    injectCss();
    if (!card) { card = document.createElement('details'); card.className = 'card es-card'; card.id = 'esPfad'; card.open = true; card.innerHTML = '<summary>Fehlerstrompfad und Leiterfarben</summary><div class="es-cb"><div class="es-fig" data-esf></div><div data-esl></div><p class="es-note" data-esn></p></div>'; meters.parentNode.insertBefore(card, meters); }
    card.hidden = false;
    const c = S.ctl || {}, form = c.form || 'TN-S', fehler = c.fehler || 'ohne', fault = fehler === 'koerperschluss' || fehler === 'pe-unterbrochen' || !!S.fired, pb = fehler === 'pe-unterbrochen';
    const key = [form, fault, pb].join('|'); if (card.dataset.k === key) return; card.dataset.k = key;
    card.querySelector('[data-esf]').innerHTML = pfadSvg({ form, fault, peBroken: pb && fault });
    card.querySelector('[data-esl]').innerHTML = farbleiste();
    card.querySelector('[data-esn]').textContent = FORMTXT[form] + (fault ? '' : ' Löse den Körperschluss aus, dann leuchtet der Pfad.');
  }
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  function designTick() {
    const U = UI(), host = document.getElementById('designView'); if (!host) return;
    const panel = host.querySelector('[data-dpanel] .card'), h4 = panel && panel.querySelector('h4'); if (!panel || !h4) return;
    const m = /Schritt (\d) von 4/.exec(h4.textContent); if (!m) return; const n = +m[1];
    let box = panel.querySelector('.es-fig.es-d'); const S = U && U.S;
    let key = '', html = '';
    if (n === 2) { const q = num(val('ed_q')); key = 'q' + q; html = aderSvg(q) + farbleiste(); }
    else if (n === 3) {
      const dev = val('ed_dev'), In = num(val('ed_In')), form = val('ed_form');
      key = [dev, In, form].join('|');
      html = (dev === 'gG' ? sicherungSvg(In) : lsSvg((dev || '').replace('LS-', ''), In)) + '</div><div class="es-fig es-d2">' + pfadSvg({ form, fault: true }) + '<p class="es-note">' + esc(FORMTXT[form] || '') + '</p>';
    } else if (n === 4) { const r = val('ed_rcd'); key = 'r' + r + val('ed_rtype'); html = rcdSvg(r, val('ed_rtype')); }
    if (!key) { panel.querySelectorAll('.es-d,.es-d2').forEach(e => e.remove()); return; }
    if (box && box.dataset.k === n + key) return;
    panel.querySelectorAll('.es-d,.es-d2').forEach(e => e.remove());
    injectCss();
    const anchor = panel.querySelector('.ed-res') || panel.querySelector('.ed-g'); if (!anchor || !html) return;
    anchor.insertAdjacentHTML('afterend', '<div class="es-fig es-d" data-k="' + n + key + '">' + html + '</div>');
  }
  function start() { setInterval(() => { try { pfadTick(); designTick(); } catch (e) { /* Anzeige ist nur Zugabe */ } }, 400); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
  const api = { pfadSvg, farbleiste, aderSvg, lsSvg, sicherungSvg, rcdSvg, WIRE, FORMS, FORMTXT, KENN, CSS, VERSION: '1.0' };
  root.ELS_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
