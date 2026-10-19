'use strict';
/* Tonfunk Lab: Lernstand sichern und mitnehmen.
   Der Fortschritt liegt nur im Browser dieses Geräts. Hier lässt er sich als Code (Text, bei Platz auch QR) oder als Datei sichern und auf einem
   anderen Gerät wieder einlesen. Der Code enthält nur den Fortschritt (Aufgaben, Abzeichen, Kampagne, Trainer, Denkfragen), die Datei auch die
   gespeicherten Schaltungen. Das Gate-Passwort wird nie gesichert. */
(function (root) {
  const PROGRESS = ['sim.done', 'lm4.tdone', 'lm4.stats', 'lm4.trainer', 'lm4.trainerseen', 'lm4.kamp', 'lm4.think', 'lm4.badges', 'lm4.seen', 'lm4.daily', 'lm4.duels', 'lm4.escape', 'lm4.predictstats', 'sim.hints', 'lm4.name'];
  const ALLP = /^(lm4|sim|sch|code|pi|digi|mess|haus|loch|app|pr)\./, NEVER = /^lm4\.(gate|god)$/;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  function collect(full) {
    const d = {};
    if (full) { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (ALLP.test(k) && !NEVER.test(k)) d[k] = localStorage.getItem(k); } } catch (e) {} }
    else PROGRESS.forEach(k => { const v = ls.get(k); if (v != null) d[k] = v; });
    return { app: 'tonfunk-lab', v: 1, t: new Date().toISOString(), name: ls.get('lm4.name') || '', full: !!full, d };
  }
  const b64u = u8 => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pipe(u8, stream) { const r = new Response(new Blob([u8]).stream().pipeThrough(stream)); return new Uint8Array(await r.arrayBuffer()); }
  async function encode(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream !== 'undefined') { try { return 'TFL1.' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) {} }
    return 'TFL0.' + b64u(raw);
  }
  async function decode(code) {
    code = String(code || '').replace(/\s+/g, ''); const m = code.match(/^TFL([01])\.(.+)$/); if (!m) throw new Error('Das ist kein Lernstand-Code (er beginnt mit TFL).');
    let u8 = unb64u(m[2]); if (m[1] === '1') { if (typeof DecompressionStream === 'undefined') throw new Error('Dieses Gerät kann den komprimierten Code nicht lesen. Nimm die Datei.'); try { u8 = await pipe(u8, new DecompressionStream('deflate-raw')); } catch (e) { throw new Error('Der Code ist beschädigt oder unvollständig. Kopiere ihn noch einmal vollständig.'); } }
    let o; try { o = JSON.parse(new TextDecoder().decode(u8)); } catch (e) { throw new Error('Der Code ist beschädigt oder unvollständig.'); } if (!o || o.app !== 'tonfunk-lab' || !o.d) throw new Error('Der Code ist beschädigt.'); return o;
  }
  /* Zusammenführen: Zahlen höchster Wert, Listen vereinigt, Objekte rekursiv, sonst vorhandenes behalten */
  function mergeVal(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (Array.isArray(a) && Array.isArray(b)) { const out = a.slice(); b.forEach(x => { if (!out.some(y => JSON.stringify(y) === JSON.stringify(x))) out.push(x); }); return out; }
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = Object.assign({}, a); Object.keys(b).forEach(k => { o[k] = k in a ? mergeVal(a[k], b[k]) : b[k]; }); return o; }
    return a == null ? b : (b === true || a === true ? true : a);
  }
  function apply(o, mode) {
    let n = 0;
    Object.keys(o.d).forEach(k => {
      if (!ALLP.test(k) || NEVER.test(k)) return; const cur = ls.get(k), inc = o.d[k];
      if (mode === 'replace' || cur == null) { ls.set(k, inc); n++; return; }
      if (k === 'lm4.name') return;
      try { const a = JSON.parse(cur), b = JSON.parse(inc); ls.set(k, JSON.stringify(mergeVal(a, b))); n++; } catch (e) { /* kein JSON: vorhandenes behalten */ }
    });
    return n;
  }
  const overlay = html => {
    const old = document.getElementById('lsBox'); if (old) old.remove();
    const w = document.createElement('div'); w.id = 'lsBox'; w.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom)) 14px;-webkit-overflow-scrolling:touch';
    w.innerHTML = `<div style="background:#222830;color:#e8ecf0;border:1px solid #38424d;border-radius:16px;max-width:560px;width:100%;padding:16px;font:14px/1.4 system-ui,sans-serif"><div style="position:sticky;top:-16px;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;background:#222830;padding:6px 0"><b style="font-size:17px">💾 Lernstand sichern und laden</b><button id="lsX" style="flex:none;min-width:48px;height:44px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font-size:22px;cursor:pointer" aria-label="Schließen">✕</button></div>${html}<button id="lsX2" style="display:block;width:100%;height:46px;margin-top:12px;border-radius:12px;background:#2c343e;border:1px solid #46525f;color:#e8eaed;font:600 15px system-ui;cursor:pointer">Schließen</button></div>`;
    document.body.appendChild(w); w.addEventListener('pointerdown', e => { if (e.target === w) w.remove(); }); w.querySelector('#lsX').onclick = () => w.remove(); w.querySelector('#lsX2').onclick = () => w.remove(); return w;
  };
  const btn = (id, t, pri) => `<button id="${id}" style="height:38px;padding:0 14px;border-radius:10px;border:1px solid ${pri ? '#3b9eff' : '#38424d'};background:${pri ? '#3b9eff' : '#2c343e'};color:#fff;font:600 14px system-ui;cursor:pointer;margin:3px 6px 3px 0">${t}</button>`;
  async function open() {
    const prog = collect(false), code = await encode(prog), done = Object.keys(JSON.parse(prog.d['sim.done'] || '{}')).length;
    const w = overlay(`<p style="color:#8d99a6;margin:0 0 10px">Dein Fortschritt liegt nur auf diesem Gerät. Sichere ihn hier, damit er beim Gerätewechsel oder nach dem Zurücksetzen nicht verloren geht. ${esc(prog.name || 'Ohne Namen')} · ${done} Aufgaben im Speicher.</p>
      <b>1. Sichern</b><p style="margin:4px 0;color:#8d99a6;font-size:13px">Der Code enthält nur den Fortschritt. Schreibe ihn dir auf, speichere ihn in einer Notiz oder schicke ihn dir selbst.</p>
      <textarea id="lsCode" readonly rows="4" style="width:100%;font:12px ui-monospace,monospace;background:#14181c;color:#e8ecf0;border:1px solid #38424d;border-radius:8px;padding:6px">${esc(code)}</textarea>
      ${btn('lsCopy', 'Code kopieren', true)}${btn('lsFile', 'Alles als Datei speichern')}${code.length < 2300 ? btn('lsQr', 'QR anzeigen') : ''}<div id="lsQrBox" style="margin:8px 0"></div>
      <hr style="border:0;border-top:1px solid #38424d;margin:12px 0"><b>2. Laden</b><p style="margin:4px 0;color:#8d99a6;font-size:13px">Code einfügen oder Datei wählen. „Zusammenführen“ behält das Beste aus beiden Ständen, „Ersetzen“ überschreibt diesen Stand.</p>
      <textarea id="lsIn" rows="3" placeholder="Code hier einfügen (beginnt mit TFL)" style="width:100%;font:12px ui-monospace,monospace;background:#14181c;color:#e8ecf0;border:1px solid #38424d;border-radius:8px;padding:6px"></textarea>
      <label style="font-size:13px;display:block;margin:4px 0"><input type="radio" name="lsMode" value="merge" checked> Zusammenführen (empfohlen)</label><label style="font-size:13px;display:block;margin:0 0 4px"><input type="radio" name="lsMode" value="replace"> Ersetzen</label>
      ${btn('lsLoad', 'Einlesen', true)}<input type="file" id="lsPick" accept=".json,.txt,application/json" style="font-size:12px;max-width:100%"><div id="lsMsg" style="margin-top:8px;min-height:20px"></div>`);
    const msg = (t, ok) => { const m = w.querySelector('#lsMsg'); m.style.color = ok ? '#4cd964' : '#ff8a7a'; m.textContent = t; };
    w.querySelector('#lsCopy').onclick = async () => { try { await navigator.clipboard.writeText(code); msg('Code kopiert.', true); } catch (e) { const t = w.querySelector('#lsCode'); t.select(); document.execCommand && document.execCommand('copy'); msg('Code markiert und kopiert.', true); } };
    w.querySelector('#lsFile').onclick = () => { const f = collect(true), blob = new Blob([JSON.stringify(f)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tonfunk-lernstand-' + (f.name || 'ohne-name').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '-' + f.t.slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); msg('Datei gespeichert (mit allen gespeicherten Schaltungen).', true); };
    const q = w.querySelector('#lsQr'); if (q) q.onclick = () => { const box = w.querySelector('#lsQrBox'); const show = () => { try { const qr = root.qrcode(0, 'L'); qr.addData(code); qr.make(); box.innerHTML = qr.createImgTag(4, 8); } catch (e) { box.textContent = 'Der Code ist für ein QR zu lang. Nimm Text oder Datei.'; } }; if (root.qrcode) show(); else { const s = document.createElement('script'); s.src = 'qr.js'; s.onload = show; document.head.appendChild(s); } };
    const run = async (text) => { try { const o = text.trim().charAt(0) === '{' ? JSON.parse(text) : await decode(text); if (!o || o.app !== 'tonfunk-lab' || !o.d) throw new Error('Das ist kein Lernstand.'); const mode = w.querySelector('input[name=lsMode]:checked').value, n = apply(o, mode); msg(n + ' Einträge übernommen' + (o.name ? ' (Stand von ' + o.name + ')' : '') + '. Lade die Seite neu, um den Fortschritt zu sehen.', true); if (root.Lernpfad) { const s = document.getElementById('lernpfad'); if (s) { s.remove(); root.Lernpfad.build(); } } } catch (e) { msg(String(e.message || e), false); } };
    w.querySelector('#lsLoad').onclick = () => { const t = w.querySelector('#lsIn').value; if (!t.trim()) { msg('Bitte zuerst einen Code einfügen oder eine Datei wählen.', false); return; } run(t); };
    w.querySelector('#lsPick').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => run(String(r.result)); r.readAsText(f); };
  }
  root.Lernstand = { open, collect, encode, decode, apply, PROGRESS };
})(window);
