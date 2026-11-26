'use strict';
/* Tonfunk 3D-Druck-Lab: Bilder (reine Funktionen, die SVG-Text liefern) und ruhige Bewegung.
   vorSvg    Halter im Schnitt, Schicht für Schicht mit Wänden, Füllung und Stützen (Slicer-Vorschau)
   vorGeom   Maße des Aufbaus bei Anteil frac (0 bis 1), vorFrame setzt sie im Bild
   fehSvg    Fehlerbilder aus den Einstellungen (Verzug, Fäden, Lücken, Wulst, Spaghetti)
   ausSvg    Teil auf der Platte: Überhänge rot, Stützen schraffiert
   aufSvg    Aufbau des Druckkopfs, tempSvg Temperaturbereiche der Filamente
   Alle Texte im Bild sind mindestens 17 Einheiten hoch (viewBox 480 breit): auf dem iPhone mit 390 px über 11 px.
   Bewegung nur über CSS (prefers-reduced-motion: no-preference) und den Aufbau per Regler/Knopf. Der Endzustand ist immer ohne Bewegung zu sehen. */
(function (root) {
  const C = () => root.DRK_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 1 : d, true);
  const r1 = v => Math.round(v * 10) / 10;

  const CSS = `.dk-svg{display:block;width:100%;height:auto}
.dk-svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:17px;font-weight:600;fill:var(--fg);-webkit-user-select:none;user-select:none}
.dk-svg .dk-m{fill:var(--mute);font-weight:500}.dk-svg .dk-r{fill:var(--danger)}.dk-svg .dk-g{fill:var(--ok)}.dk-svg .dk-b{fill:var(--hi)}
.dk-lead{fill:none;stroke:var(--mute);stroke-width:1.3}.dk-dot{fill:var(--mute)}
.dk-ln{fill:none;stroke-linecap:round;stroke-linejoin:round}
.dk-flow{stroke-dasharray:8 6}.dk-ants{stroke-dasharray:7 6}
@media(prefers-reduced-motion:no-preference){
.dk-flow,.dk-ants{animation:dkflow 1.4s linear infinite}
.dk-gear{animation:dkspin 9s linear infinite;transform-box:fill-box;transform-origin:center}
.dk-heat{animation:dkheat 3.2s ease-in-out infinite}
.dk-sup{animation:dkfade .9s ease-out}
}
@keyframes dkflow{to{stroke-dashoffset:-26}}
@keyframes dkspin{to{transform:rotate(360deg)}}
@keyframes dkheat{0%,100%{opacity:.25}50%{opacity:.8}}
@keyframes dkfade{from{opacity:0}to{opacity:1}}`;
  function inject() { if (typeof document === 'undefined' || document.getElementById('drkviz-css')) return; const s = document.createElement('style'); s.id = 'drkviz-css'; s.textContent = CSS; document.head.appendChild(s); }

    const wrap = (vb, label, body) => `<svg class="dk-svg" viewBox="${vb}" role="img" aria-label="${label}">${body}</svg>`;
  const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:${a}"/><stop offset="1" style="stop-color:${b}"/></linearGradient>`;
  const lead = (x1, y1, x2, y2) => `<path class="dk-lead" d="M${x1} ${y1}L${x2} ${y2}"/><circle class="dk-dot" cx="${x2}" cy="${y2}" r="3"/>`;

  /* ============================================================ Slicer-Vorschau */
  const V = { S: 7, X0: 150, YB: 330 };
  const px = (x, y) => (V.X0 + x * V.S).toFixed(1) + ' ' + (V.YB - y * V.S).toFixed(1);
  const poly = pts => 'M' + pts.map(p => px(p[0], p[1])).join('L') + 'Z';
  /* Füllmuster als Kachel: Linienabstand folgt der Dichte (kein Muster bei 0 %, voll ab 90 %) */
  function infillTile(kind, pct) {
    const d = pct / 100, lw = 3;
    const sp = Math.max(6, (kind === 'lin' ? 1 : kind === 'gitter' ? 2 : 3) * lw / d), e = 'stroke="var(--accent)" stroke-width="1.8" fill="none"';
    const tile = { lin: `<path d="M${sp / 2} 0V${sp}" ${e}/>`, gitter: `<path d="M${sp / 2} 0V${sp}M0 ${sp / 2}H${sp}" ${e}/>`,
      waben: `<path d="M0 ${sp * .3}L${sp / 2} 0L${sp} ${sp * .3}V${sp * .7}L${sp / 2} ${sp}L0 ${sp * .7}Z" ${e}/>`,
      gyroid: `<path d="M0 ${sp / 2}C${sp / 4} ${-sp / 4} ${sp * .75} ${sp * 1.25} ${sp} ${sp / 2}" ${e}/>` }[kind];
    return `<pattern id="dv-inf" width="${sp}" height="${sp}" patternUnits="userSpaceOnUse"${kind === 'lin' ? ' patternTransform="rotate(45)"' : ''}>${tile}</pattern>`;
  }
  function vorGeom(p, frac) {
    const c = C(), fr = Math.max(0, Math.min(1, frac)), L = c.layersOf(c.SL.H, p.h), n = Math.round(fr * L);
    const y = V.YB - fr * c.SL.H * V.S, onArm = fr * c.SL.H > c.SL.H - c.SL.AT;
    return { clipY: y - 0.5, layer: n, layers: L, show: fr < 1, nozX: V.X0 + (onArm ? 154 + 120 * Math.sin(fr * 40) : 49), nozY: y };
  }
  function vorFrame(svg, p, frac) {
    const g = vorGeom(p, frac), cr = svg.querySelector('#dv-cr'), nz = svg.querySelector('#dv-nz'), tx = svg.querySelector('#dv-lt');
    cr.setAttribute('y', g.clipY); cr.setAttribute('height', 362 - g.clipY);
    nz.setAttribute('transform', 'translate(' + r1(g.nozX) + ' ' + r1(g.nozY) + ')'); nz.setAttribute('visibility', g.show ? 'visible' : 'hidden');
    tx.textContent = 'Schicht ' + g.layer + '/' + g.layers;
  }
  /* p = { h, walls, infill, pattern, support: 'aus'|'normal'|'baum' } */
  function vorSvg(p, frac) {
    const c = C(), S = c.SL, g = vorGeom(p, frac), t = p.walls * S.LW, s = S.DECK * p.h, hs = Math.max(p.h * V.S, 2.6);
    const outer = [[0, 0], [14, 0], [14, 32], [44, 32], [44, 40], [0, 40]], inner = [[t, s], [14 - t, s], [14 - t, 32 + s], [44 - t, 32 + s], [44 - t, 40 - s], [t, 40 - s]];
    const full = p.infill >= 90, none = p.infill <= 0;
    const sup = p.support === 'normal' ? `<g class="dk-sup"><rect x="${px(14, 32).split(' ')[0]}" y="${px(14, 32).split(' ')[1]}" width="${30 * V.S}" height="${32 * V.S}" fill="url(#dv-sup)" stroke="var(--hi)" stroke-width="1.6" stroke-dasharray="5 4"/></g>`
      : p.support === 'baum' ? `<g class="dk-sup dk-ln" stroke="var(--hi)" stroke-width="4"><path d="M${px(29, 0)}L${px(29, 14)}M${px(29, 14)}L${px(19, 31)}M${px(29, 14)}L${px(29, 31)}M${px(29, 14)}L${px(39, 31)}"/><circle cx="${px(19, 31).split(' ')[0]}" cy="${px(19, 31).split(' ')[1]}" r="3" fill="var(--hi)"/><circle cx="${px(29, 31).split(' ')[0]}" cy="${px(29, 31).split(' ')[1]}" r="3" fill="var(--hi)"/><circle cx="${px(39, 31).split(' ')[0]}" cy="${px(39, 31).split(' ')[1]}" r="3" fill="var(--hi)"/></g>` : '';
    const cx = V.X0 + 29 * V.S, cy = V.YB - 16 * V.S;
    const note = p.support === 'aus' ? `<path d="M${px(14, 32)}L${px(44, 32)}" stroke="var(--danger)" stroke-width="3" stroke-dasharray="7 5" fill="none"/><rect x="${cx - 70}" y="${cy - 22}" width="140" height="44" rx="8" fill="var(--bg)" opacity=".9"/><text class="dk-r" x="${cx}" y="${cy - 2}" text-anchor="middle">Überhang</text><text class="dk-r" x="${cx}" y="${cy + 16}" text-anchor="middle">frei in der Luft</text>`
      : `<text class="dk-b" x="${cx}" y="${cy + 6}" text-anchor="middle" stroke="var(--bg)" stroke-width="4" paint-order="stroke">${p.support === 'baum' ? 'Baumstützen' : 'Stützen'}</text>`;
    const body = `<defs>${grad('dv-g', 'var(--accent)', 'var(--accent-bg)')}${grad('dv-p', 'var(--panel2)', 'var(--line)')}
      <pattern id="dv-sup" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="var(--hi)" stroke-width="2.4" opacity=".7"/></pattern>
      <pattern id="dv-lay" width="10" height="${hs}" y="${V.YB}" patternUnits="userSpaceOnUse"><path d="M0 0H10" stroke="var(--bg)" stroke-width="1" opacity=".55"/></pattern>
      ${none || full ? '' : infillTile(p.pattern, p.infill)}
      <clipPath id="dv-cp"><rect id="dv-cr" x="0" y="${g.clipY}" width="480" height="${362 - g.clipY}"/></clipPath></defs>
      <rect x="4" y="${V.YB}" width="472" height="24" rx="6" fill="url(#dv-p)" stroke="var(--line)"/><text class="dk-m" x="240" y="${V.YB + 18}" text-anchor="middle">Bauplatte</text>
      <g clip-path="url(#dv-cp)">${sup}<path d="${poly(outer)}" fill="url(#dv-g)" stroke="var(--accent-bg)" stroke-width="1.5"/>
        <path d="${poly(inner)}" fill="${full ? 'var(--accent)' : 'var(--bg)'}" opacity="${full ? .55 : 1}"/>${none || full ? '' : `<path d="${poly(inner)}" fill="url(#dv-inf)"/>`}
        <path d="${poly(outer)}" fill="url(#dv-lay)"/></g>${note}
      <g id="dv-nz" transform="translate(${r1(g.nozX)} ${r1(g.nozY)})" visibility="${g.show ? 'visible' : 'hidden'}"><path d="M-3 0L3 0L9 -12L-9 -12Z" fill="var(--hi)" stroke="var(--fg)" stroke-width="1"/><rect x="-15" y="-34" width="30" height="22" rx="4" fill="var(--mute)" stroke="var(--fg)" stroke-width="1"/><path d="M0 -34V-52" stroke="var(--hi)" stroke-width="3"/></g>
      <text id="dv-lt" x="6" y="24">Schicht ${g.layer}/${g.layers}</text>
      ${lead(100, 55, V.X0 + 6, 55)}<text class="dk-m" x="6" y="60">Deckschicht</text>
      ${lead(100, 140, V.X0 + t * V.S / 2, 140)}<text x="6" y="145">${f(p.walls, 0)} ${p.walls === 1 ? 'Wand' : 'Wände'}</text>
      ${lead(106, 212, V.X0 + 49, 212)}<text x="6" y="217">Füllung ${f(p.infill, 0)} %</text>
      ${lead(112, 305, V.X0 + 8, V.YB - 2)}<text class="dk-b" x="6" y="310">Schicht ${f(p.h, 2)} mm</text>`;
    return wrap('0 0 480 362', 'Halter im Schnitt mit Wänden, Füllung und Stützen, Schicht für Schicht aufgebaut', body);
  }

  /* ============================================================ Fehlerbilder */
  /* st = { bed, noz, fan, ret, mat }, d = Ergebnis von DRK_CORE.diagnose(st) */
  function fehSvg(st, d) {
    const c = C(), sv = d.sev, F = c.FSCHW, YP = 250, found = k => sv[k] >= F;
    const lift = sv.warp * 28, foot = sv.foot * 11, mix = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')', bedCol = mix([74, 163, 255], [255, 90, 60], Math.min(1, Math.max(0, (st.bed - 20) / 90))), nozCol = mix([255, 200, 60], [255, 70, 40], Math.min(1, Math.max(0, (st.noz - 180) / 100)));
    let b = `<defs>${grad('df-g', 'var(--accent)', 'var(--accent-bg)')}<linearGradient id="df-bed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bedCol}"/><stop offset="1" stop-color="${bedCol}" stop-opacity=".45"/></linearGradient></defs>`;
    for (let i = 0; i < Math.max(1, Math.round(st.fan / 25)); i++) b += `<path class="dk-flow dk-ln" d="M${20 + i * 6} ${52 + i * 11}H${160 + i * 8}" stroke="var(--accent)" stroke-width="2.4" opacity=".55"/>`;
    b += `<circle cx="18" cy="18" r="8" fill="${nozCol}" stroke="var(--fg)" stroke-width="1"/><text x="34" y="24">Düse ${f(st.noz, 0)} °C</text><text x="190" y="24">Lüfter ${f(st.fan, 0)} %</text><text x="338" y="24">Rückzug ${f(st.ret, 1)} mm</text>`;
    b += `<rect x="10" y="${YP}" width="460" height="22" rx="5" fill="url(#df-bed)" stroke="var(--line)"/><text x="22" y="${YP + 17}" style="fill:#fff;paint-order:stroke;stroke:#0009;stroke-width:3px">Bett ${f(st.bed, 0)} °C</text>`;
    for (let i = 0; i < 4; i++) b += `<path class="dk-heat dk-ln" d="M${190 + i * 70} ${YP + 11}q8 -7 16 0t16 0t16 0" stroke="#fff" stroke-width="2.4" style="animation-delay:${i * .6}s"/>`;
    /* Block links: Verzug und Wulst */
    const x0 = 20, x1 = 150, y0 = 150;
    if (foot > 1) b += `<path d="M${x0 - foot} ${YP}H${x1 + foot}L${x1} ${YP - 16}H${x0}Z" fill="var(--accent-bg)" stroke="var(--danger)" stroke-width="2"/>`;
    b += `<path d="M${x0} ${YP - lift}C${x0 + 30} ${YP} ${x1 - 30} ${YP} ${x1} ${YP - lift}L${x1} ${y0 - lift}Q${(x0 + x1) / 2} ${y0} ${x0} ${y0 - lift}Z" fill="url(#df-g)" stroke="var(--accent-bg)" stroke-width="1.5"/>`;
    for (let y = y0 + 12; y < YP - 4; y += 12) b += `<path d="M${x0 + 4} ${y - lift * (YP - y) / 100 * .2}H${x1 - 4}" stroke="var(--bg)" stroke-width="1" opacity=".45"/>`;
    if (found('warp')) b += `<path class="dk-ln" d="M${x0 - 6} ${YP - lift - 8}v-14m0 0l-5 6m5 -6l5 6M${x1 + 6} ${YP - lift - 8}v-14m0 0l-5 6m5 -6l5 6" stroke="var(--danger)" stroke-width="2.4"/>`;
    /* Türme in der Mitte: Fäden */
    b += `<rect x="180" y="140" width="16" height="110" rx="3" fill="url(#df-g)"/><rect x="236" y="140" width="16" height="110" rx="3" fill="url(#df-g)"/>`;
    for (let i = 0; i < Math.round(sv.string * 8); i++) { const y = 156 + i * 11; b += `<path class="dk-ln" d="M196 ${y}Q216 ${y + 9} 236 ${y}" stroke="var(--fg)" stroke-width="1.6" opacity=".75"/>`; }
    /* Wand rechts: Lücken */
    for (let r = 0; r < 16; r++) for (let j = 0; j < 10; j++) if (((r * 7 + j * 13) % 10) / 10 >= sv.under * .85) b += `<path class="dk-ln" d="M${294 + j * 16.5} ${YP - 6 - r * 6.2}h14" stroke="var(--accent)" stroke-width="4.4"/>`;
    /* Spaghetti */
    if (found('spag')) b += `<path class="dk-ln" d="M30 ${YP - 6}C80 120 130 260 190 130S300 250 330 120S420 240 460 ${YP - 8}M40 190C110 100 170 230 240 150S380 90 450 200M60 ${YP - 20}C120 170 220 110 300 ${YP - 20}S400 140 440 170" stroke="var(--hi)" stroke-width="3.2" opacity=".9"/>`;
    const lab = (x, arr) => arr.length ? arr.map((n, i) => `<text class="dk-r" x="${x}" y="${296 + i * 20}" text-anchor="middle">${n}</text>`).join('') : `<text class="dk-g" x="${x}" y="296" text-anchor="middle">in Ordnung</text>`;
    const names = ks => ks.filter(found).map(k => c.fehlOf(k).n);
    b += lab(85, names(['warp', 'foot'])) + lab(216, names(['string'])) + lab(372, names(['under']));
    if (found('spag')) b += `<text class="dk-b" x="240" y="344" text-anchor="middle">${c.fehlOf('spag').n}: das Teil hat sich gelöst</text>`;
    return wrap('0 0 480 354', 'Fehlerbild-Bild: Block, zwei Türme und Wand mit den Folgen der Einstellungen', b);
  }

  /* ============================================================ Überhang und Ausrichtung */
  const AY = 300, AS = 5;
  function ausSvg(key, deg, support) {
    const c = C(), a = c.analyse(key, deg), ox = 240 - a.w * AS / 2, X = x => (ox + x * AS).toFixed(1), Y = y => (AY - y * AS).toFixed(1);
    let b = `<defs>${grad('da-g', 'var(--accent)', 'var(--accent-bg)')}${grad('da-p', 'var(--panel2)', 'var(--line)')}<pattern id="da-sup" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="var(--hi)" stroke-width="2.4" opacity=".75"/></pattern></defs>`;
    b += `<rect x="4" y="${AY}" width="472" height="24" rx="6" fill="url(#da-p)" stroke="var(--line)"/><text class="dk-m" x="240" y="${AY + 18}" text-anchor="middle">Bauplatte</text>`;
    if (support) b += '<g class="dk-sup">' + a.cols.map(q => `<rect x="${X(q[0] - q[3] / 2)}" y="${Y(q[2])}" width="${(q[3] * AS + .4).toFixed(1)}" height="${((q[2] - q[1]) * AS).toFixed(1)}" fill="url(#da-sup)"/>`).join('') + '</g>';
    b += `<path d="${a.rings.map(r => 'M' + r.map(p => X(p[0]) + ' ' + Y(p[1])).join('L') + 'Z').join('')}" fill="url(#da-g)" fill-rule="evenodd" stroke="none"/>`;
    a.edges.forEach(e => {
      const d = `M${X(e.a[0])} ${Y(e.a[1])}L${X(e.b[0])} ${Y(e.b[1])}`;
      b += e.kind === 'ueber' ? `<path class="dk-ants dk-ln" d="${d}" stroke="var(--danger)" stroke-width="5"/>` : e.kind === 'auf' ? `<path class="dk-ln" d="${d}" stroke="var(--ok)" stroke-width="5"/>` : `<path class="dk-ln" d="${d}" stroke="var(--accent-bg)" stroke-width="2"/>`;
      if (e.kind === 'ueber' && e.len >= 6) { const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2; b += `<text class="dk-r" x="${X(mx)}" y="${(AY - my * AS + 4 + (-dx / e.len) * 20).toFixed(1)}" text-anchor="middle" style="paint-order:stroke;stroke:var(--bg);stroke-width:4px">${e.ang}°</text>`; }
    });
    b += `<text x="6" y="24">Drehung ${f(deg, 0)}°</text><text class="dk-g" x="474" y="24" text-anchor="end">grün: liegt auf</text><text class="dk-r" x="474" y="44" text-anchor="end">rot: Überhang</text>`;
    return wrap('0 0 480 330', 'Teil auf der Bauplatte mit rot markierten Überhängen und schraffierten Stützen', b);
  }

  /* ============================================================ Aufbau des Druckkopfs */
  function aufSvg() {
    const t = (x, y, s, cl) => `<text${cl ? ` class="${cl}"` : ''} x="${x}" y="${y}">${s}</text>`;
    let b = `<defs>${grad('dg-o', 'var(--hi)', 'var(--danger)')}${grad('dg-m', 'var(--mute)', 'var(--line)')}${grad('dg-p', 'var(--panel2)', 'var(--line)')}${grad('dg-a', 'var(--accent)', 'var(--accent-bg)')}</defs>`;
    b += `<g class="dk-gear"><circle cx="70" cy="80" r="52" fill="var(--panel2)" stroke="var(--mute)" stroke-width="2"/><circle cx="70" cy="80" r="38" fill="none" stroke="var(--hi)" stroke-width="10" opacity=".8"/><circle cx="70" cy="80" r="12" fill="var(--bg)" stroke="var(--mute)" stroke-width="2"/><path d="M70 30V130M20 80H120" stroke="var(--mute)" stroke-width="2" opacity=".6"/></g>`;
    b += t(70, 152, 'Spule', 'dk-m').replace('<text', '<text text-anchor="middle"');
    b += `<path class="dk-flow dk-ln" d="M122 70C160 70 168 32 212 32V232" stroke="var(--hi)" stroke-width="4"/>`;
    b += `<rect x="168" y="58" width="92" height="68" rx="9" fill="url(#dg-p)" stroke="var(--mute)" stroke-width="1.6" opacity=".95"/><g class="dk-gear"><circle cx="192" cy="92" r="20" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2" stroke-dasharray="6 3"/><circle cx="192" cy="92" r="6" fill="var(--fg)"/></g><circle cx="232" cy="92" r="11" fill="var(--panel2)" stroke="var(--fg)" stroke-width="2"/><path d="M212 58V126" stroke="var(--hi)" stroke-width="4"/>`;
    b += t(270, 84, 'Extruder') + t(270, 102, 'schiebt', 'dk-m');
    b += `<rect x="203" y="126" width="18" height="14" fill="url(#dg-m)"/><rect x="186" y="140" width="54" height="40" rx="6" fill="url(#dg-o)" stroke="var(--fg)" stroke-width="1.6"/><path d="M212 140V180" stroke="var(--hi)" stroke-width="4"/>`;
    b += t(270, 156, 'Hotend') + t(270, 174, 'schmilzt', 'dk-m');
    b += `<path d="M197 180H227L218 208H206Z" fill="url(#dg-o)" stroke="var(--fg)" stroke-width="1.6"/>` + t(270, 205, 'Düse');
    b += `<rect x="112" y="186" width="44" height="26" rx="5" fill="url(#dg-a)" stroke="var(--fg)" stroke-width="1.4"/>`;
    for (let i = 0; i < 3; i++) b += `<path class="dk-flow dk-ln" d="M${164} ${192 + i * 7}H${194 + i * 3}" stroke="var(--accent)" stroke-width="2.4" opacity=".8"/>`;
    b += t(106, 204, 'Lüfter', 'dk-m').replace('<text', '<text text-anchor="end"');
    b += `<rect x="176" y="212" width="88" height="38" rx="4" fill="url(#dg-a)" stroke="var(--accent-bg)"/>` + t(274, 236, 'Teil');
    b += `<rect x="10" y="250" width="460" height="24" rx="6" fill="url(#dg-p)" stroke="var(--line)"/>` + t(240, 267, 'Heizbett (Bauplatte)').replace('<text', '<text text-anchor="middle"');
    for (let i = 0; i < 5; i++) b += `<path class="dk-heat dk-ln" d="M${60 + i * 88} 296q8 -7 0 -13t0 -12" stroke="var(--danger)" stroke-width="2.6" style="animation-delay:${i * .5}s"/>`;
    return wrap('0 0 480 304', 'Aufbau des Druckkopfs: Spule, Extruder, Hotend mit Düse, Lüfter und Heizbett', b);
  }

  /* ============================================================ Temperaturbereiche */
  function tempSvg(sel) {
    const c = C(), X = v => 92 + v * 1.25;
    let b = `<text x="92" y="18" class="dk-b">■ Düse</text><text x="170" y="18" style="fill:var(--accent)">■ Bett</text>`;
    c.FIL.forEach((m, i) => {
      const y = 34 + i * 46, on = m.k === sel;
      b += `<rect x="2" y="${y - 6}" width="476" height="42" rx="8" fill="${on ? 'var(--panel2)' : 'none'}" stroke="${on ? 'var(--accent)' : 'none'}" stroke-width="1.5"/><text x="10" y="${y + 20}"${on ? '' : ' class="dk-m"'}>${m.n}</text>`;
      b += `<rect x="${X(m.nl)}" y="${y}" width="${(m.nh - m.nl) * 1.25}" height="14" rx="7" fill="var(--hi)"/><rect x="${X(m.bl)}" y="${y + 18}" width="${(m.bh - m.bl) * 1.25}" height="12" rx="6" fill="var(--accent)"/>`;
    });
    for (let v = 0; v <= 300; v += 100) b += `<path d="M${X(v)} 30V266" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/><text class="dk-m" x="${X(v)}" y="286" text-anchor="${v === 300 ? 'end' : 'middle'}">${v} °C</text>`;
    return wrap('0 0 480 294', 'Düsen- und Betttemperatur der Filamente als Balken', b);
  }

  const API = { CSS, inject, vorGeom, vorFrame, vorSvg, fehSvg, ausSvg, aufSvg, tempSvg };
  root.DRK_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
