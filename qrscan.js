'use strict';
/* qrscan.js (Paket D3): kleiner Kamera-Scanner fuer QR-Codes, gemeinsam fuer das Duell (Gegner-Code) und die Ausbilder-Uebersicht.
   jsqr.js (251 KB) liegt NICHT im Precache: es wird erst beim ersten Scan nachgeladen (gleiche Mechanik wie Dash.loadJsQR) und vom Service Worker danach gecacht.
   Nichts wird gesendet; das Kamerabild bleibt im Browser und wird nach dem Scan sofort beendet. Fehlt Kamera oder Scanner, bleibt das Einfuegen per Text.
   QrScan.open({ title, onText(text) -> true (fertig, schliessen) | Fehltext (weiter scannen) }) */
(function (root) {
  let lade = null;
  function loadJsQR() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (lade) return lade;
    lade = new Promise((res, rej) => {
      if (typeof document === 'undefined') { rej(new Error('Scanner nicht verfügbar')); return; }
      const s = document.createElement('script'); s.src = 'jsqr.js';
      s.onload = () => (root.jsQR ? res(root.jsQR) : rej(new Error('Scanner-Bibliothek defekt')));
      s.onerror = () => { s.remove(); rej(new Error('Scanner (jsqr.js) nicht geladen: einmal online öffnen')); };
      document.head.appendChild(s);
    }).catch(e => { lade = null; throw e; });
    return lade;
  }
  const CSS = `#qsBox{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:14px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#qsBox .qs{background:#1e2327;color:#e8eaed;border:1px solid #46505a;border-radius:14px;max-width:460px;width:100%;padding:14px 16px}
#qsBox h2{font-size:18px;margin:0 0 8px}#qsBox video{width:100%;max-height:48vh;border-radius:10px;background:#000;display:none}
#qsBox .msg{min-height:22px;margin:8px 0;color:#c9d1d9}#qsBox .msg.err{color:#ff9d92}
#qsBox button{min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;border:1px solid #5b6875;background:#2c343e;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}
#qsBox button:focus-visible{outline:3px solid #ffd166;outline-offset:2px}`;
  let st = null;
  function close() {
    if (!st) return; const s = st; st = null;
    if (s.raf) cancelAnimationFrame(s.raf); if (s.stream) s.stream.getTracks().forEach(t => t.stop());
    document.removeEventListener('keydown', s.key, true); if (s.box) s.box.remove(); if (s.back && s.back.focus) { try { s.back.focus(); } catch (e) {} }
  }
  async function open(o) {
    o = o || {}; close();
    if (!document.getElementById('qsCss')) { const c = document.createElement('style'); c.id = 'qsCss'; c.textContent = CSS; document.head.appendChild(c); }
    const box = document.createElement('div'); box.id = 'qsBox';
    box.innerHTML = '<div class="qs" role="dialog" aria-modal="true" aria-labelledby="qsT"><h2 id="qsT"></h2><video playsinline muted></video><p class="msg" role="status" aria-live="polite">Kamera wird gestartet …</p><div><button type="button" id="qsX">Schließen</button></div></div>';
    box.querySelector('#qsT').textContent = o.title || 'QR-Code scannen';
    document.body.appendChild(box);
    const s = st = { box, raf: 0, stream: null, back: document.activeElement, key: e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } } };
    document.addEventListener('keydown', s.key, true);
    const msg = box.querySelector('.msg'), vid = box.querySelector('video'), say = (t, err) => { msg.textContent = t; msg.className = 'msg' + (err ? ' err' : ''); };
    box.querySelector('#qsX').onclick = close; box.querySelector('#qsX').focus();
    box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { say('Kamera nicht verfügbar. Seite über https öffnen oder den Code als Text einfügen.', true); return; }
    try { s.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { if (st === s) say('Kamera nicht verfügbar (Zugriff erlauben). Du kannst den Code stattdessen als Text einfügen.', true); return; }
    if (st !== s) { s.stream.getTracks().forEach(t => t.stop()); return; }
    say('Scanner wird geladen …');
    try { await loadJsQR(); } catch (e) { if (st === s) { say('Scanner konnte nicht geladen werden. Einmal mit Internet öffnen oder den Code als Text einfügen.', true); s.stream.getTracks().forEach(t => t.stop()); s.stream = null; } return; }
    if (st !== s) return;
    vid.srcObject = s.stream; vid.style.display = 'block'; try { await vid.play(); } catch (e) {}
    say('Bitte QR-Code ins Bild halten …');
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); let last = '', lastT = 0;
    const loop = () => {
      if (st !== s) return;
      if (vid.readyState >= 2 && vid.videoWidth) {
        const k = Math.min(1, 640 / vid.videoWidth); cv.width = Math.round(vid.videoWidth * k); cv.height = Math.round(vid.videoHeight * k); cx.drawImage(vid, 0, 0, cv.width, cv.height);
        const img = cx.getImageData(0, 0, cv.width, cv.height), r = root.jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
        if (r && r.data && (r.data !== last || Date.now() - lastT > 3000)) {
          last = r.data; lastT = Date.now();
          let res = true; try { res = o.onText ? o.onText(r.data) : true; } catch (e) { res = 'Der Code konnte nicht gelesen werden.'; }
          if (res === true) { close(); return; }
          say(typeof res === 'string' ? res : 'Das ist kein passender Code.', true);
        }
      }
      s.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  const QrScan = { open, close, loadJsQR };
  if (typeof module !== 'undefined' && module.exports) module.exports = QrScan; else root.QrScan = QrScan;
})(typeof window !== 'undefined' ? window : globalThis);
