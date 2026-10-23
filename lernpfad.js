'use strict';
/* Tonfunk Lab: Lernpfad auf der Startseite.
   Drei Spuren (Elektronik, Installation, Programmieren) mit empfohlener Reihenfolge, Schwierigkeit und Fortschritt je Lab.
   Der Fortschritt kommt aus den vorhandenen Ergebnissen (sim.done, lm4.tdone), die Liste der Labs und Aufgaben aus aufgaben.js. */
(function (root) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const REG = root.LAB_REG || {}, ROWS = root.AUFGABEN || [];
  const TRACKS = [
    { t: 'Elektronik von Grund auf', s: 'Von der einfachen Schaltung über das Löten und die Digitaltechnik bis zur Messtechnik, zur elektrischen Sicherheit und Geräteprüfung, zu Netzteilen und Schaltreglern, zur Leiterplatte, zur speicherprogrammierbaren Steuerung (SPS), zu den Antrieben, zur Sensorik, zur Regelungstechnik, zur Wärmeabfuhr mit dem Kühlkörper und zur elektromagnetischen Verträglichkeit (EMV) und zur Solartechnik (Energie).', labs: ['loch', 'sch', 'digi', 'mess', 'els', 'nts', 'sps', 'pcb', 'ant', 'sen', 'reg', 'thm', 'emv', 'enr'] },
    { t: 'Installation und Anlagen', s: 'Wie Strom im Haus verteilt, geschaltet und abgesichert wird.', labs: ['sim', 'haus'], pre: 'Empfohlen vorher: SchaltLab' },
    { t: 'Prüfungsvorbereitung', s: 'Die Abschlussprüfung üben: Datenblätter lesen (Grenzwerte, Kennlinien, Fachenglisch), Themen trainieren, Rechnen, Probeprüfung mit Zeitlimit und Auswertung. Das Thema Sicherheit und Normen übst du zusätzlich nach dem Sicherheits-Lab: die Abschaltbedingung, die Schutzmaßnahmen und die Geräteprüfung kommen in der Prüfung vor. Das Thema Stromversorgung übst du nach dem Netzteil-Lab: Gleichrichter, Siebung, Z-Diode, Linearregler und Schaltregler kommen in der Prüfung vor.', labs: ['ds', 'pr'], links: [['pruefungslab.html?thema=sicherheit', 'Sicherheit und Normen üben (Prüfungs-Lab)'], ['elslab.html', 'Dazu im Sicherheits-Lab ausprobieren'], ['pruefungslab.html?thema=netzteile', 'Stromversorgung üben (Prüfungs-Lab)'], ['ntslab.html', 'Dazu im Netzteil-Lab ausprobieren']], pre: 'Am besten nach SchaltLab, DigiLab und MessLab' },
    { t: 'Programmieren und Steuern', s: 'Eigene Apps mit KI bauen, dann Schaltungen mit Programmen steuern: Arduino und Raspberry Pi.', labs: ['app', 'code', 'pi'], pre: 'Die App-Werkstatt braucht kein Vorwissen. Für Arduino und Pi empfohlen: SchaltLab' },
    { t: 'Verbundprojekte', s: 'Alle Labs arbeiten zusammen an einem Gerät: Garagentor, Ampel, Digitale Uhr, Gartenbewässerung und Förderanlage. Jede Station liefert ihr Ergebnis an die nächste, am Ende gibt es Gesamttest und Zertifikat.', labs: ['vb'], pre: 'Am besten nach den Labs, die ein Projekt braucht (Datenblatt, Schaltplan, Leiterplatte, Messen, Antrieb, Sensorik, SPS)' }
  ];
  const LEVEL = { sch: 'Einstieg', loch: 'Einstieg', mess: 'Mittel', els: 'Fortgeschritten', nts: 'Fortgeschritten', digi: 'Mittel', sim: 'Mittel', haus: 'Fortgeschritten', app: 'Einstieg', pr: 'Fortgeschritten', code: 'Mittel', pi: 'Fortgeschritten', sps: 'Mittel', pcb: 'Mittel', ant: 'Mittel', sen: 'Mittel', reg: 'Fortgeschritten', thm: 'Mittel', emv: 'Fortgeschritten', enr: 'Mittel', ds: 'Mittel', vb: 'Fortgeschritten' };
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const results = () => { const m = {}; [get('sim.done', {}), get('lm4.tdone', {})].forEach(o => Object.keys(o).forEach(k => { const v = +o[k] || 0; if (v > (m[k] || 0)) m[k] = v; })); return m; };
  const trained = lab => !!get('lm4.trainer', {})[lab];
  function stat(lab) {
    const res = results(), rows = ROWS.filter(r => r[1] === lab).sort((a, b) => a[4] - b[4]), done = rows.filter(r => (res[r[0]] || 0) >= 100), todo = rows.filter(r => (res[r[0]] || 0) < 100);
    const lv = rows.length ? rows.reduce((s, r) => s + r[4], 0) / rows.length : 1;
    return { n: rows.length, d: done.length, next: todo[0] || null, started: done.length > 0 || rows.some(r => (res[r[0]] || 0) > 0), level: LEVEL[lab] || (lv < 1.75 ? 'Einstieg' : lv < 2.4 ? 'Mittel' : 'Anspruchsvoll'), pct: rows.length ? Math.round(100 * done.length / rows.length) : 0 };
  }
  const css = '.lp{margin:0 0 20px}.lp h2{margin:0 0 4px;font-size:20px}.lp .sub{color:var(--mute);margin:0 0 14px;font-size:14px}.lp .trk{margin:0 0 16px}.lp .trk h3{margin:0;font-size:15px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.lp .trk h3 small{font-weight:400;color:var(--mute);font-size:12px}.lp .trk p{margin:2px 0 8px;color:var(--mute);font-size:13px}'
    + '.lp .st{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.lp .step{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}.lp .step.rec{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.lp .step .no{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--panel2);font-size:12px;font-weight:700;margin-right:6px}.lp .step b{font-size:15px}'
    + '.lp .bar{height:6px;border-radius:3px;background:var(--panel2);overflow:hidden}.lp .bar i{display:block;height:100%;background:#4cd964;border-radius:3px}.lp .meta{display:flex;justify-content:space-between;font-size:12px;color:var(--mute)}.lp .lvl{padding:1px 8px;border-radius:9px;background:var(--panel2);border:1px solid var(--line);font-size:11px}.lp .go{display:flex;gap:6px;margin-top:2px}.lp .go a{flex:1;text-align:center;padding:8px 6px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;background:var(--panel2);border:1px solid var(--line);color:var(--fg)}.lp .go a.pri{background:var(--accent);border-color:var(--accent);color:#fff;flex:2}'
    + '.lp .badge{position:absolute;top:-9px;right:10px;background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:9px}.lp .kamp{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-radius:14px;border:1px solid #ff9d00;background:rgba(255,157,0,.08);margin-bottom:18px}.lp .kamp .bar{flex:1;min-width:140px}'
    + '.mp{margin:2px 0 4px}.mp .bar{height:5px;border-radius:3px;background:var(--panel2);overflow:hidden}.mp .bar i{display:block;height:100%;background:#4cd964}.mp small{display:flex;justify-content:space-between;color:var(--mute);font-size:12px;margin-top:3px}';
  function build() {
    const q = document.querySelector('.q'), cards = document.querySelector('.cards'); if (!q || !cards || document.getElementById('lernpfad')) return;
    const st = {}; Object.keys(REG).forEach(k => { st[k] = stat(k); });
    const order = TRACKS.reduce((a, t) => a.concat(t.labs), []).filter(k => REG[k]);
    let rec = order.find(k => st[k].n && st[k].pct < 100 && st[k].started) || order.find(k => st[k].n && st[k].pct < 100);
    const labKeys = Object.keys(st).filter(k => !(REG[k] || {}).hub);   // der Hub Projekte zählt nicht als Lab
    const total = labKeys.reduce((n, k) => n + st[k].n, 0), done = labKeys.reduce((n, k) => n + st[k].d, 0);
    const K = root.Kampagne, kt = K ? K.CH.reduce((n, c) => n + c.m.length, 0) : 0, kd = K ? K.CH.reduce((n, c) => n + K.prog(c).d, 0) : 0;
    const nx = rec && st[rec].next ? st[rec] : null, R0 = rec ? REG[rec] : null;
    const goHref = !rec ? '' : (st[rec].started || trained(rec) ? (nx ? `${R0.file}?aufgabe=${nx.next[0]}` : R0.file) : `${R0.file}?trainer`);
    const goTxt = !rec ? '' : (st[rec].started || trained(rec) ? (nx ? 'Weiter: ' + R0.name + ' · ' + (nx.next[3].length > 30 ? nx.next[3].slice(0, 29) + '…' : nx.next[3]) : R0.name + ' öffnen') : 'Start: ' + R0.name + ' (Einführung)');
    const open = (() => { try { return localStorage.getItem('lm4.lp.open') === '1'; } catch (e) { return false; } })();
    let h = `<style>${css}.lp .hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 14px;text-align:left;color:var(--fg);cursor:pointer}.lp .hd .ar{font-size:14px;transition:transform .15s;display:inline-block}.lp.open .hd .ar{transform:rotate(90deg)}.lp .hd b{font-size:17px}.lp .hd .sum{flex:1;min-width:160px;color:var(--mute);font-size:13px}.lp .hd .nx{padding:7px 12px;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:13px;text-decoration:none;max-width:100%}.lp .body{display:none;margin-top:14px}.lp.open .body{display:block}</style>`
      + `<div class="hd" id="lpHd" role="button" tabindex="0" aria-expanded="${open}"><span class="ar">▸</span><b>Dein Lernpfad</b><span class="sum">${done} von ${total} Aufgaben` + (K ? ` · Kampagne ${kd} von ${kt}` : '') + (done === 0 ? ' · Neu hier? Beginne mit dem SchaltLab.' : '') + `</span>` + (goHref ? `<a class="nx" href="${esc(goHref)}">${esc(goTxt)}</a>` : '') + `<span style="color:var(--mute);font-size:12px">${open ? 'zuklappen' : 'aufklappen'}</span></div><div class="body"><p class="sub">Wähle eine Spur und gehe von links nach rechts.</p>`;
    if (K) h += `<div class="kamp"><span style="font-size:26px">🎯</span><div style="flex:1;min-width:200px"><b>Kampagne: Das Abschlussgerät</b><br><span style="color:var(--mute);font-size:13px">${K.CH.length} Kapitel mit Meister Funk durch alle Labs. ${kd} von ${kt} Missionen erledigt.</span></div><div class="bar"><i style="width:${kt ? Math.round(100 * kd / kt) : 0}%"></i></div><a href="#" id="lpKamp" class="btn pri" style="flex:none;padding:0 18px;height:40px">Kampagne öffnen</a></div>`;
    TRACKS.forEach(tr => {
      const labs = tr.labs.filter(k => REG[k]); if (!labs.length) return;
      h += `<div class="trk"><h3>${esc(tr.t)}${tr.pre ? `<small>${esc(tr.pre)}</small>` : ''}</h3><p>${esc(tr.s)}</p>${(tr.links || []).length ? `<p class="lk">${tr.links.map(l => `<a href="${esc(l[0])}" style="color:var(--accent);margin-right:14px">${esc(l[1])}</a>`).join('')}</p>` : ''}<div class="st">`;
      labs.forEach((k, i) => {
        const s = st[k], R = REG[k], isRec = k === rec;
        const go = s.pct >= 100 ? `<a class="pri" href="${esc(R.file)}">Wiederholen</a>` : (!s.started && !trained(k) ? `<a class="pri" href="${esc(R.file)}?trainer">Einführung starten</a><a href="${esc(R.file)}">Öffnen</a>` : (s.next ? `<a class="pri" href="${esc(R.file)}?aufgabe=${esc(s.next[0])}" title="${esc(s.next[3])}">Weiter: ${esc(s.next[3].length > 26 ? s.next[3].slice(0, 25) + '…' : s.next[3])}</a><a href="${esc(R.file)}">Öffnen</a>` : `<a class="pri" href="${esc(R.file)}">Öffnen</a>`));
        h += `<div class="step ${isRec ? 'rec' : ''}">${isRec ? `<span class="badge">${s.started ? 'Weiter hier' : 'Start hier'}</span>` : ''}<div><span class="no">${i + 1}</span><b>${esc(R.name)}</b></div><div class="meta"><span class="lvl">${s.level}</span><span>${s.d} von ${s.n} Aufgaben</span></div><div class="bar"><i style="width:${s.pct}%"></i></div><div class="go">${go}</div></div>`;
      });
      h += '</div></div>';
    });
    h += '<button type="button" id="lpClose" style="display:block;width:100%;margin-top:12px;height:42px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--fg);font:600 14px system-ui;cursor:pointer">▲ Lernpfad zuklappen</button></div>';
    const sec = document.createElement('section'); sec.id = 'lernpfad'; sec.className = 'lp' + (open ? ' open' : ''); sec.innerHTML = h;
    q.parentNode.insertBefore(sec, q); q.textContent = 'Alle Programme im Überblick';
    const hd = document.getElementById('lpHd'), tog = () => { const o = sec.classList.toggle('open'); hd.setAttribute('aria-expanded', o); hd.lastElementChild.textContent = o ? 'zuklappen' : 'aufklappen'; try { localStorage.setItem('lm4.lp.open', o ? '1' : '0'); } catch (e) {} };
    hd.addEventListener('click', e => { if (e.target.closest('a')) return; tog(); }); hd.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
    const cl = document.getElementById('lpClose'); if (cl) cl.onclick = () => { tog(); hd.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    const kb = document.getElementById('lpKamp'); if (kb) kb.onclick = e => { e.preventDefault(); K.open(); };
    const kc = document.getElementById('kampCard'); if (kc) kc.remove();
    // Fortschritt auch in den Karten
    cards.querySelectorAll('.card').forEach(c => {
      const a = c.querySelector('.btns a'); if (!a) return; const file = a.getAttribute('href').split('?')[0], key = Object.keys(REG).find(k => REG[k].file === file); if (!key || !st[key].n) return;
      const s = st[key], p = document.createElement('div'); p.className = 'mp'; p.innerHTML = `<div class="bar"><i style="width:${s.pct}%"></i></div><small><span>${s.level}</span><span>${s.d} von ${s.n} Aufgaben</span></small>`;
      const steps = c.querySelector('.steps'); (steps || c.querySelector('p')).insertAdjacentElement('afterend', p);
    });
  }
  const run = () => { try { build(); } catch (e) { console.error(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 60)); else setTimeout(run, 60);
  root.Lernpfad = { build, stat, TRACKS };
})(window);
