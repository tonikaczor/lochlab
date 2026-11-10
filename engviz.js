'use strict';
/* Tonfunk Technisches-Englisch-Lab: Visualisierungen (engviz.js, wird NACH engui.js eingebunden).
   Reine SVG-Funktionen (ENG_VIZ.*, in Node testbar) plus kleine Anbindung an die Nachschlag-Reiter (nicht Aufgaben/Trainer/Vokabelkarten):
   Wortliste: Wortfeld-Skizze (Deutsch erst nach Antippen), Warnhinweise: Warnschild mit Signalwort-Leiter, Zahlen & Einheiten:
   Stellenwert-Streifen und Doppel-Lineal, Nachschlagen: beschriftete Bauteile zweisprachig (auch als Selbsttest).
   Die Wörter kommen aus ENG_DATA, nichts ist doppelt gepflegt. Farben über CSS-Variablen; die Signalfarben stammen aus ENG_CORE.SIGNALS. */
(function (root) {
  const N = v => (isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const V = {};
  const STYLE = '.vz svg{display:block;width:100%;height:auto;max-width:460px;margin:0 auto}.vz svg text{font-family:system-ui,sans-serif;fill:var(--fg)}.vz .m{fill:var(--mute)!important}'
    + '.vz .p{fill:var(--panel2);stroke:var(--fg);stroke-width:1.6}.vz .q{fill:var(--panel);stroke:var(--fg);stroke-width:1.6}.vz .a{fill:var(--accent);fill-opacity:.4;stroke:var(--fg);stroke-width:1.2}.vz .w{fill:none;stroke:var(--fg);stroke-width:2.2;stroke-linejoin:round}.vz .b{stroke:var(--fg);stroke-width:3}.vz .b2{stroke:var(--fg);stroke-width:2}.vz .t{stroke:var(--mute);stroke-width:1.2;fill:none}'
    + '.vz .cap{margin:6px 0 0;font-size:13px;color:var(--mute);line-height:1.4}.vz [data-wi]{cursor:pointer;touch-action:manipulation}.vz .ctl{margin-top:8px}';
  const wrap = (t, n) => { const out = []; let line = ''; String(t).split(/\s+/).forEach(w => { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }); if (line) out.push(line); return out; };

  /* ---------- Wortfeld ---------- */
  /* hub: Mitteltext, words: [{en,de}] (höchstens 6), open: Menge der aufgedeckten Indizes oder true (alle) */
  V.wortfeld = function (hub, words, open) {
    words = (words || []).slice(0, 6);
    const pos = [[170, 34], [268, 92], [268, 208], [170, 266], [72, 208], [72, 92]];
    let g = '';
    words.forEach((w, i) => g += `<line x1="170" y1="150" x2="${pos[i][0]}" y2="${pos[i][1]}" style="stroke:var(--line);stroke-width:2"/>`);
    g += `<circle cx="170" cy="150" r="42" style="fill:var(--accent-bg)"/>`;
    wrap(hub || 'Wortfeld', 12).slice(0, 3).forEach((l, i, a) => g += `<text x="170" y="${N(150 + (i - (a.length - 1) / 2) * 14 + 4)}" font-size="12" font-weight="700" text-anchor="middle" style="fill:#fff">${esc(l)}</text>`);
    words.forEach((w, i) => {
      const [x, y] = pos[i], show = open === true || (open && open.has && open.has(i));
      const en = wrap(w.en, 17).slice(0, 2);
      g += `<g data-wi="${i}" role="button" tabindex="0" aria-label="${esc(w.en)}, tippen für Deutsch"><rect x="${x - 56}" y="${y - 24}" width="112" height="48" rx="10" style="fill:var(--panel);stroke:${show ? 'var(--accent)' : 'var(--line)'};stroke-width:${show ? 2 : 1.4}"/>`;
      en.forEach((l, j) => g += `<text x="${x}" y="${N(y - (show ? 5 : 0) - (en.length - 1) * 6 + j * 13 + 4)}" font-size="11.5" font-weight="700" text-anchor="middle">${esc(l)}</text>`);
      g += show ? `<text x="${x}" y="${y + 16}" font-size="11" text-anchor="middle" style="fill:var(--accent)">${esc(wrap(w.de, 20)[0])}</text>` : `<text x="${x}" y="${y + 18}" font-size="10" class="m" text-anchor="middle">antippen</text>`;
      g += '</g>';
    });
    return `<svg viewBox="0 0 340 300" role="group" aria-label="Wortfeld ${esc(hub || '')}: bis zu sechs englische Wörter, Deutsch nach Antippen">${g}</svg>`;
  };

  /* ---------- Warnschild ---------- */
  V.SIGLEVEL = ['NOTICE', 'CAUTION', 'WARNING', 'DANGER'];
  /* sig: {w,de,color}, text: englischer Hinweistext, de: deutscher Text oder '' */
  V.warnschild = function (sig, text, de) {
    if (!sig) return '';
    const dark = sig.w === 'CAUTION', tc = dark ? '#1b1f24' : '#fff';
    let g = `<rect x="8" y="6" width="284" height="${de ? 156 : 132}" rx="8" style="fill:var(--panel);stroke:var(--fg);stroke-width:2"/><path d="M8 14a8 8 0 0 1 8-8h268a8 8 0 0 1 8 8v30H8Z" style="fill:${sig.color}"/>`;
    g += `<text x="150" y="33" font-size="21" font-weight="800" text-anchor="middle" style="fill:${tc};letter-spacing:1.5px">${esc(sig.w)}</text>`;
    wrap(text || '', 40).slice(0, 4).forEach((l, i) => g += `<text x="20" y="${64 + i * 16}" font-size="12.5">${esc(l)}</text>`);
    if (de) wrap(de, 44).slice(0, 3).forEach((l, i) => g += `<text x="20" y="${126 + i * 14}" font-size="11.5" style="fill:var(--accent)">${esc(l)}</text>`);
    const y = (de ? 156 : 132) + 20, idx = V.SIGLEVEL.indexOf(sig.w);
    V.SIGLEVEL.forEach((w, i) => {
      const x = 8 + i * 72, on = i === idx;
      g += `<rect x="${x}" y="${y}" width="68" height="22" rx="11" style="fill:${on ? sig.color : 'var(--panel2)'};stroke:${on ? 'var(--fg)' : 'var(--line)'};stroke-width:${on ? 2 : 1}"/><text x="${x + 34}" y="${y + 15}" font-size="10" font-weight="700" text-anchor="middle" style="fill:${on ? tc : 'var(--mute)'}">${w}</text>`;
    });
    g += `<text x="8" y="${y + 38}" font-size="10.5" class="m">schwerere Folgen →</text>`;
    return `<svg viewBox="0 0 300 ${y + 46}" role="img" aria-label="Warnschild mit Signalwort ${esc(sig.w)}">${g}</svg>`;
  };

  /* ---------- Stellenwert-Streifen ---------- */
  V.NUMRE = /^[-+]?[\d.,]+$/;
  /* s: Zahl als Text, mode 'en' | 'de'; other: dieselbe Zahl in der anderen Schreibweise oder '' */
  V.stellen = function (s, mode, other) {
    s = String(s || '').trim();
    if (!V.NUMRE.test(s) || s.length > 16) return '';
    const row = (txt, md, y, lab) => {
      const w = Math.min(24, 300 / txt.length), x0 = (340 - w * txt.length) / 2;
      let g = `<text x="6" y="${y - 6}" font-size="11" font-weight="700" class="m">${lab}</text>`;
      txt.split('').forEach((ch, i) => {
        const x = x0 + i * w, sep = ch === ',' || ch === '.', th = sep && ((md === 'en' && ch === ',') || (md === 'de' && ch === '.'));
        g += sep ? `<circle cx="${N(x + w / 2)}" cy="${y + 18}" r="${N(Math.min(11, w / 2))}" style="fill:${th ? 'var(--accent-bg)' : 'var(--hi)'}"/><text x="${N(x + w / 2)}" y="${y + (ch === ',' ? 22 : 26)}" font-size="${ch === ',' ? 24 : 22}" font-weight="900" text-anchor="middle" style="fill:#fff">${ch}</text>`
          : `<rect x="${N(x + 1)}" y="${y}" width="${N(w - 2)}" height="36" rx="5" style="fill:var(--panel);stroke:var(--line)"/><text x="${N(x + w / 2)}" y="${y + 25}" font-size="17" font-weight="600" text-anchor="middle">${esc(ch)}</text>`;
      });
      return g;
    };
    let g = row(s, mode, 22, mode === 'en' ? 'Englisch' : 'Deutsch');
    if (other) g += row(other, mode === 'en' ? 'de' : 'en', 86, mode === 'en' ? 'Deutsch' : 'Englisch');
    const ly = other ? 144 : 80;
    g += `<circle cx="14" cy="${ly}" r="7" style="fill:var(--accent-bg)"/><text x="26" y="${ly + 4}" font-size="11.5">Tausender-Trenner</text><circle cx="166" cy="${ly}" r="7" style="fill:var(--hi)"/><text x="178" y="${ly + 4}" font-size="11.5">Dezimal-Trenner</text>`;
    return `<svg viewBox="0 0 340 ${ly + 12}" role="img" aria-label="Zahl ${esc(s)}: Tausender-Trenner und Dezimal-Trenner farbig markiert">${g}</svg>`;
  };

  /* ---------- Doppel-Lineal für Einheiten ---------- */
  const nice = (span, n) => { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; };
  const lab = x => { const r = Math.round(x * 1e6) / 1e6; return String(r).replace('.', ','); };
  /* v Wert in from-Einheit, cv: from -> to, temp: Temperaturskala (Bereich um den Wert statt ab 0) */
  V.lineal = function (v, from, to, cv, temp) {
    if (!isFinite(v) || typeof cv !== 'function') return '';
    let lo, hi;
    if (temp) { const sp = Math.max(15, Math.abs(v) * 0.5); lo = v - sp; hi = v + sp; } else { lo = Math.min(0, v * 1.2); hi = Math.max(0, v * 1.2); if (hi - lo <= 0) hi = 1; }
    const a = cv(lo), b = cv(hi); if (!isFinite(a) || !isFinite(b) || a === b) return '';
    const X0 = 22, WW = 296, X = val => X0 + (val - lo) / (hi - lo) * WW;
    const bot = val => X0 + (val - Math.min(a, b)) / Math.abs(b - a) * WW;
    const scale = (y, from0, to0, mapx, unit, up, conv) => {
      let g = `<line x1="${X0}" y1="${y}" x2="${X0 + WW}" y2="${y}" style="stroke:var(--fg);stroke-width:2"/>`;
      const st = nice(to0 - from0, 6);
      for (let t = Math.ceil(from0 / st - 1e-9) * st; t <= to0 + 1e-9 && g.length < 9000; t += st) {
        const x = N(mapx(t)); if (x < X0 - 1 || x > X0 + WW + 1) continue;
        g += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + (up ? -9 : 9)}" style="stroke:var(--fg);stroke-width:1.4"/><text x="${x}" y="${y + (up ? -13 : 22)}" font-size="10.5" text-anchor="middle">${lab(t)}</text>`;
      }
      return g + `<text x="${X0 + WW}" y="${y + (up ? -26 : 38)}" font-size="12" font-weight="700" text-anchor="end">${esc(unit)}</text>`;
    };
    let g = scale(48, lo, hi, X, from, true) + scale(98, Math.min(a, b), Math.max(a, b), bot, to, false);
    const xv = N(X(v)), r = cv(v);
    g += `<line x1="${xv}" y1="22" x2="${xv}" y2="112" style="stroke:var(--hi);stroke-width:2.4"/><circle cx="${xv}" cy="48" r="4.5" style="fill:var(--hi)"/><circle cx="${N(a < b ? bot(r) : bot(r))}" cy="98" r="4.5" style="fill:var(--hi)"/>`;
    return `<svg viewBox="0 0 340 146" role="img" aria-label="Doppel-Lineal: derselbe Wert auf der Skala in ${esc(from)} und in ${esc(to)}">${g}</svg>`;
  };

  /* ---------- Bauteile beschriften ---------- */
  /* Zeichnungen mit Beschriftungsankern: Wort (englisch, wird im Vokabular nachgeschlagen), Zeigerziel (x,y), Textposition (tx,ty,Anker) */
  V.TEILE = {
    schraube: { name: 'Schraubverbindung', labels: [['screw', 120, 60, 214, 46, 'start'], ['washer', 120, 112, 214, 90, 'start'], ['nut', 120, 130, 214, 134, 'start'], ['thread', 120, 152, 214, 178, 'start']],
      art: '<rect x="70" y="14" width="100" height="26" rx="3" class="p"/><rect x="108" y="40" width="24" height="132" class="p"/><rect x="40" y="62" width="160" height="38" class="q"/><rect x="92" y="106" width="56" height="8" class="a"/><rect x="96" y="114" width="48" height="26" class="p"/>'
        + [150, 155, 160, 165, 170].map(y => `<line x1="108" y1="${y}" x2="132" y2="${y}" class="t"/>`).join('') },
    welle: { name: 'Welle mit Lager', labels: [['shaft', 40, 82, 22, 34, 'start'], ['bearing', 150, 82, 150, 28, 'middle'], ['seal', 196, 82, 240, 52, 'start'], ['gear', 250, 130, 214, 176, 'start']],
      art: '<rect x="10" y="74" width="280" height="16" class="p"/><rect x="128" y="46" width="44" height="72" rx="4" class="q"/><circle cx="150" cy="60" r="6" class="a"/><circle cx="150" cy="104" r="6" class="a"/><rect x="176" y="60" width="6" height="44" class="a"/>'
        + '<polygon points="250,100 258,104 266,100 270,108 280,110 276,120 282,128 274,134 276,144 266,146 262,154 254,150 246,154 242,146 232,144 234,134 226,128 232,120 228,110 238,108 242,100" class="q"/><circle cx="254" cy="126" r="10" class="p"/>' },
    kreis: { name: 'Stromkreis', labels: [['battery', 40, 86, 22, 40, 'start'], ['switch', 150, 40, 150, 22, 'middle'], ['fuse', 262, 86, 238, 40, 'start'], ['resistor', 80, 150, 40, 188, 'start'], ['load', 220, 150, 226, 188, 'start']],
      art: '<path d="M40 86V40H120M180 40H262V86V150H250M190 150H110M70 150H40V86" class="w"/><line x1="40" y1="76" x2="40" y2="96" class="b"/><line x1="48" y1="80" x2="48" y2="92" class="b2"/><circle cx="125" cy="40" r="3" class="a"/><circle cx="175" cy="40" r="3" class="a"/><line x1="125" y1="40" x2="170" y2="22" class="w"/>'
        + '<rect x="248" y="68" width="28" height="36" class="q"/><line x1="262" y1="68" x2="262" y2="104" class="t"/><rect x="70" y="140" width="40" height="20" class="q"/><circle cx="220" cy="150" r="14" class="q"/><path d="M210 140l20 20M230 140l-20 20" class="t"/>' }
  };
  /* tr: Funktion englisch -> deutsch oder null; modus 'zwei' (EN + DE), 'nur' (nur EN, Antippen zeigt DE), open: Menge aufgedeckter Indizes */
  V.teile = function (key, tr, modus, open) {
    const T = V.TEILE[key]; if (!T) return '';
    let g = T.art;
    T.labels.forEach((L, i) => {
      const de = tr ? tr(L[0]) : null; if (!de) return;
      const show = modus === 'zwei' || (open && open.has && open.has(i));
      g += `<g data-wi="${i}" role="button" tabindex="0" aria-label="${esc(L[0])}"><line x1="${L[1]}" y1="${L[2]}" x2="${L[3]}" y2="${L[4] + (L[4] < L[2] ? 6 : -4)}" style="stroke:var(--accent);stroke-width:1.6"/><circle cx="${L[1]}" cy="${L[2]}" r="3.5" style="fill:var(--accent)"/>`
        + `<rect x="${L[5] === 'middle' ? L[3] - 52 : L[3] - 4}" y="${L[4] - 15}" width="${L[5] === 'middle' ? 104 : 96}" height="${show ? 34 : 22}" rx="6" style="fill:var(--panel);stroke:var(--line)"/>`
        + `<text x="${L[5] === 'middle' ? L[3] : L[3] + 4}" y="${L[4] + 1}" font-size="12" font-weight="700" text-anchor="${L[5] === 'middle' ? 'middle' : 'start'}">${esc(L[0])}</text>`
        + (show ? `<text x="${L[5] === 'middle' ? L[3] : L[3] + 4}" y="${L[4] + 14}" font-size="11" text-anchor="${L[5] === 'middle' ? 'middle' : 'start'}" style="fill:var(--accent)">${esc(de.split(',')[0])}</text>` : '') + '</g>';
    });
    return `<svg viewBox="0 0 320 200" role="img" aria-label="${esc(T.name)}, Bauteile englisch beschriftet">${g}</svg>`;
  };

  root.ENG_VIZ = V;
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  if (typeof document === 'undefined' || !document.getElementById) return;

  /* ============================================================ Anbindung an die Seite */
  const C = root.ENG_CORE, D = root.ENG_DATA;
  if (!C || !D) return;
  const reduce = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  void reduce;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.eng.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const card = (key, title, inner) => { const d = document.createElement('div'); d.className = 'card pl vz'; d.setAttribute('data-vz', key); d.innerHTML = `<h4>${title}</h4>${inner}`; return d; };
  const trans = en => { const v = D.vocab.find(x => x.en === en); return v ? v.de : null; };
  const seg = (attr, opts, cur) => `<div class="ctl" role="group">${opts.map(o => `<button class="chip s${cur === o[0] ? ' on' : ''}" ${attr}="${esc(o[0])}" aria-pressed="${cur === o[0]}">${esc(o[1])}</button>`).join('')}</div>`;

  const W = {
    wort: {
      view: 'wortView', place: cs => [cs[0], 'before'], off: 0, open: new Set(), all: false,
      make() {
        const self = this, n = card('wort', 'Wortfeld: tippe ein Wort an', '<div class="inst fit" data-b="1"></div><div class="ctl"><button class="chip s" data-m="next">Andere Wörter</button><button class="chip s" data-m="all" aria-pressed="false">Alle Deutsch zeigen</button></div><p class="cap">Sechs Wörter aus deiner Auswahl (Beruf und Fachgebiet oben). Sage zuerst die Übersetzung, dann tippe zur Kontrolle.</p>');
        n.addEventListener('click', e => {
          const m = e.target.closest('[data-m]'), w = e.target.closest('[data-wi]');
          if (m) { if (m.dataset.m === 'next') { self.off += 6; self.open = new Set(); self.all = false; } else self.all = !self.all; }
          else if (w) { const i = +w.dataset.wi; if (self.open.has(i)) self.open.delete(i); else self.open.add(i); } else return;
          self.upd(n);
        });
        n.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-wi]')) { e.preventDefault(); e.target.closest('[data-wi]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
        return n;
      },
      upd(n) {
        const hv = document.getElementById('wortView'), job = ($('[data-vf=job]', hv) || {}).value || 'all', g = ($('[data-vf=g]', hv) || {}).value || 'all', key = job + '|' + g;
        if (this.key !== key) { this.key = key; this.off = 0; this.open = new Set(); this.all = false; }
        const cs = C.filterCards(D.vocab, job, g).filter(c => c.en.length <= 24 && c.de.length <= 26);
        const words = []; for (let i = 0; i < Math.min(6, cs.length); i++) words.push(cs[(this.off + i) % cs.length]);
        const hub = g === 'all' ? 'Wortfeld' : D.groupName(g);
        $('[data-b]', n).innerHTML = words.length ? V.wortfeld(hub, words, this.all ? true : this.open) : '<p class="hint2" style="padding:8px;margin:0">Für diese Auswahl gibt es keine Wörter.</p>';
        const a = $('[data-m=all]', n); a.classList.toggle('on', this.all); a.setAttribute('aria-pressed', this.all);
      }
    },
    warn: {
      view: 'warnView', place: cs => [cs[0], 'after'], idx: 0, de: false, lastSig: null,
      make() {
        const self = this, n = card('warn', 'So sieht ein Warnhinweis aus', '<div class="inst fit" data-b="1" style="padding:8px"></div><div class="ctl"><button class="chip s" data-m="next">Anderes Beispiel</button><button class="chip s" data-m="de" aria-pressed="false">Deutsch zeigen</button></div><p class="cap">Das Signalwort steht im farbigen Kopf, darunter der Hinweistext. Unten siehst du, wo das Wort auf der Leiter der Folgen steht.</p>');
        n.addEventListener('click', e => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'next') { self.idx++; self.de = false; } else self.de = !self.de; self.upd(n); });
        return n;
      },
      upd(n) {
        const sv = lsGet('warn', {}), info = { injury: sv.injury || 'serious', imminent: (sv.imminent == null ? '1' : sv.imminent) === '1' };
        const hv = document.getElementById('warnView'), on = $('[data-wi].on', hv), inj = on ? on.dataset.wi : info.injury, im = $('[data-wm].on', hv), imm = im ? im.dataset.wm === '1' : info.imminent;
        const w = C.signalFor({ injury: inj, imminent: imm }), sig = C.SIGNALS.find(x => x.w === w);
        if (this.lastSig !== w) { this.lastSig = w; this.idx = 0; this.de = false; }
        const ex = D.warn.filter(x => x.sig === w), e = ex.length ? ex[this.idx % ex.length] : null;
        $('[data-b]', n).innerHTML = V.warnschild(sig, e ? e.en : '', this.de && e ? e.de : '');
        const b = $('[data-m=de]', n); b.classList.toggle('on', this.de); b.setAttribute('aria-pressed', this.de);
      }
    },
    notation: {
      view: 'zahlView', place: cs => [cs[0], 'after'],
      make() { return card('notation', 'Die Zahl in Stellen zerlegt', '<div class="inst fit" data-b="1" style="padding:8px"></div><p class="cap">Englisch: Komma trennt die Tausender, der Punkt ist das Dezimalzeichen. Deutsch: genau umgekehrt.</p>'); },
      upd(n) {
        const z = Object.assign({ s: '1,250.5', mode: 'en' }, lsGet('zahl', {})), mode = z.mode === 'de' ? 'de' : 'en', s = String(z.s || '').trim();
        const ok = C.isNotation(s, mode), svg = ok ? V.stellen(s, mode, C.convertNotation(s, mode, mode === 'en' ? 'de' : 'en')) : '';
        $('[data-b]', n).innerHTML = svg || '<p class="hint2" style="padding:8px;margin:0">Gib eine gültige Zahl in der gewählten Schreibweise ein.</p>';
      }
    },
    lineal: {
      view: 'zahlView', place: cs => [cs[1], 'after'],
      make() { return card('lineal', 'Dasselbe Maß, zwei Skalen', '<div class="inst fit" data-b="1" style="padding:8px"></div><p class="cap">Oben die Skala der Ausgangseinheit, unten die der Zieleinheit. Die orange Linie markiert deinen Wert auf beiden Skalen.</p>'); },
      upd(n) {
        const z = Object.assign({ q: 'len', v: '2,5', from: 'in', to: 'mm' }, lsGet('zahl', {})), v = C.parseNum(z.v);
        const svg = isFinite(v) ? V.lineal(v, z.from, z.to, x => C.conv(x, z.from, z.to), z.q === 'temp') : '';
        $('[data-b]', n).innerHTML = svg || '<p class="hint2" style="padding:8px;margin:0">Gib einen Wert ein und wähle zwei Einheiten der gleichen Größe.</p>';
      }
    },
    teile: {
      view: 'refView', place: () => [null, 'before'], key: 'schraube', modus: 'zwei', open: new Set(),
      make() {
        const self = this, n = card('teile', 'Bauteile beschriften',
          seg('data-k', Object.keys(V.TEILE).map(k => [k, V.TEILE[k].name]), self.key) + '<div class="inst fit" data-b="1"></div>' + seg('data-md', [['zwei', 'Englisch und Deutsch'], ['nur', 'Selbsttest: nur Englisch']], self.modus) + '<p class="cap" data-c="1"></p>');
        n.addEventListener('click', e => {
          const k = e.target.closest('[data-k]'), md = e.target.closest('[data-md]'), w = e.target.closest('[data-wi]');
          if (k) { self.key = k.dataset.k; self.open = new Set(); } else if (md) { self.modus = md.dataset.md; self.open = new Set(); }
          else if (w && self.modus === 'nur') { const i = +w.dataset.wi; if (self.open.has(i)) self.open.delete(i); else self.open.add(i); } else return;
          self.upd(n);
        });
        return n;
      },
      upd(n) {
        $('[data-b]', n).innerHTML = V.teile(this.key, trans, this.modus, this.open);
        $('[data-c]', n).textContent = this.modus === 'zwei' ? 'Die Wörter stehen auch in der Wortliste und im Vokabeltrainer.' : 'Sage zuerst das deutsche Wort. Tippe ein Schild an, dann siehst du die Lösung.';
        $$('[data-k]', n).forEach(b => { const on = b.dataset.k === this.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        $$('[data-md]', n).forEach(b => { const on = b.dataset.md === this.modus; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      }
    }
  };

  function sync(key) {
    const w = W[key], host = document.getElementById(w.view); if (!host) return;
    let n = host.querySelector(':scope > [data-vz="' + key + '"]');
    const cs = [...host.querySelectorAll(':scope > .card:not(.vz)')];
    if (key !== 'teile' && !cs.length) { if (n) n.remove(); return; }
    if (key === 'teile' && !host.querySelector(':scope > .dt')) { if (n) n.remove(); return; }
    if (!n) {
      n = w.make();
      if (key === 'teile') host.querySelector(':scope > .dt').before(n);
      else { const p = w.place(cs); if (p[0]) (p[1] === 'before' ? p[0].before(n) : p[0].after(n)); else host.appendChild(n); }
    }
    w.upd(n);
  }
  Object.keys(W).forEach(key => {
    const host = document.getElementById(W[key].view); if (!host) return;
    new MutationObserver(() => sync(key)).observe(host, { childList: true });
    ['input', 'change', 'click'].forEach(ev => host.addEventListener(ev, e => { if (!e.target.closest('.vz')) sync(key); }));
    sync(key);
  });
})(typeof window !== 'undefined' ? window : globalThis);
