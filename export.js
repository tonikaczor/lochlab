/* Export: Bild (PNG) und Animation (GIF) der laufenden Schaltung, alles ohne Bibliothek (eigener GIF-Encoder).
   Die Aufnahme zeichnet die Zeichenfläche mit, während die Simulation läuft. Speichern über das Teilen-Menü des Geräts (iPad: „In Dateien sichern“) oder als Download. */
(function () {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function ui() { return { sheet: (window.LabUI && window.LabUI.sheet) || window.sheet, toast: (window.LabUI && window.LabUI.toast) || window.toast || function () {} }; }
  function canvas() { return document.getElementById('cv'); }
  function simOn() { var s = document.querySelector('.simsw'); return !!s && s.getAttribute('aria-checked') === 'true'; }
  function fname(ext) {
    var t = (document.querySelector('header .title') || {}).textContent || 'Schaltung';
    t = String(t).split('\n')[0].trim().replace(/[^\wäöüÄÖÜß\- ]+/g, '').trim().replace(/\s+/g, '-') || 'Schaltung';
    return 'Tonfunk-' + t + '.' + ext;
  }
  async function saveBlob(blob, name) {
    try { var f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* ---------- GIF-Encoder ---------- */
  function buildPalette(frames) {
    var hist = new Uint32Array(32768);
    frames.forEach(function (d) { for (var i = 0; i < d.length; i += 12) hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++; });
    var keys = []; for (var k = 0; k < 32768; k++) if (hist[k]) keys.push(k);
    var ch = function (key, c) { return c === 0 ? (key >> 10) & 31 : c === 1 ? (key >> 5) & 31 : key & 31; };
    var boxes = [keys];
    while (boxes.length < 256) {
      var bi = -1, bs = 0, bc = 0;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i]; if (b.length < 2) continue;
        var mn = [31, 31, 31], mx = [0, 0, 0], pop = 0;
        for (var j = 0; j < b.length; j++) { for (var c = 0; c < 3; c++) { var v = ch(b[j], c); if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; } pop += hist[b[j]]; }
        var rng = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], r = Math.max(rng[0], rng[1], rng[2]), sc = r * Math.sqrt(pop);
        if (sc > bs) { bs = sc; bi = i; bc = rng[0] >= rng[1] && rng[0] >= rng[2] ? 0 : (rng[1] >= rng[2] ? 1 : 2); }
      }
      if (bi < 0) break;
      var box = boxes[bi]; box.sort(function (a, b2) { return ch(a, bc) - ch(b2, bc); });
      var tot = 0; box.forEach(function (q) { tot += hist[q]; });
      var acc = 0, cut = 1; for (var m = 0; m < box.length - 1; m++) { acc += hist[box[m]]; if (acc >= tot / 2) { cut = m + 1; break; } cut = m + 1; }
      boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }
    var pal = [];
    boxes.forEach(function (b) {
      var r = 0, g = 0, bl = 0, n = 0; b.forEach(function (q) { var w = hist[q]; r += ((q >> 10) & 31) * w; g += ((q >> 5) & 31) * w; bl += (q & 31) * w; n += w; });
      var rr = Math.round(r / n), gg = Math.round(g / n), bb = Math.round(bl / n);
      pal.push([(rr << 3) | (rr >> 2), (gg << 3) | (gg >> 2), (bb << 3) | (bb >> 2)]);
    });
    while (pal.length < 256) pal.push([0, 0, 0]);
    return pal;
  }
  function mapper(pal) {
    var cache = new Int16Array(32768).fill(-1);
    return function (r, g, b) {
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), c = cache[key]; if (c >= 0) return c;
      var best = 0, bd = 1e9, rr = (r >> 3 << 3) | 4, gg = (g >> 3 << 3) | 4, bb = (b >> 3 << 3) | 4;
      for (var i = 0; i < 256; i++) { var p = pal[i], d = (p[0] - rr) * (p[0] - rr) + (p[1] - gg) * (p[1] - gg) + (p[2] - bb) * (p[2] - bb); if (d < bd) { bd = d; best = i; } }
      cache[key] = best; return best;
    };
  }
  function lzw(idx) {
    var minCode = 8, clear = 256, eoi = 257, codeSize = 9, next = 258, dict = new Map(), out = [], cur = 0, bits = 0;
    function emit(code) { cur |= code << bits; bits += codeSize; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } }
    emit(clear); var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = (prefix << 8) | k, c = dict.get(key);
      if (c !== undefined) { prefix = c; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next - 1 > (1 << codeSize) - 1 && codeSize < 12) codeSize++; }
      else { emit(clear); dict.clear(); next = 258; codeSize = 9; }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (bits > 0) out.push(cur & 255);
    return out;
  }
  function encodeGif(w, h, frames, delayCs) {
    var pal = buildPalette(frames), map = mapper(pal), bytes = [];
    var u16 = function (v) { bytes.push(v & 255, (v >> 8) & 255); };
    'GIF89a'.split('').forEach(function (c) { bytes.push(c.charCodeAt(0)); });
    u16(w); u16(h); bytes.push(0xF7, 0, 0); pal.forEach(function (p) { bytes.push(p[0], p[1], p[2]); });
    bytes.push(0x21, 0xFF, 11); 'NETSCAPE2.0'.split('').forEach(function (c) { bytes.push(c.charCodeAt(0)); }); bytes.push(3, 1, 0, 0, 0);
    frames.forEach(function (d) {
      bytes.push(0x21, 0xF9, 4, 0); u16(delayCs); bytes.push(0, 0);
      bytes.push(0x2C); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
      var idx = new Uint8Array(w * h); for (var i = 0, p = 0; i < idx.length; i++, p += 4) idx[i] = map(d[p], d[p + 1], d[p + 2]);
      var data = lzw(idx); bytes.push(8);
      for (var s = 0; s < data.length; s += 255) { var n = Math.min(255, data.length - s); bytes.push(n); for (var q = 0; q < n; q++) bytes.push(data[s + q]); }
      bytes.push(0);
    });
    bytes.push(0x3B);
    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  }

  /* ---------- Bedienung ---------- */
  function png() {
    var u = ui(), cv = canvas(); if (!cv) { u.toast('Keine Zeichenfläche gefunden'); return; }
    cv.toBlob(function (b) { if (b) saveBlob(b, fname('png')); else u.toast('Bild konnte nicht erzeugt werden'); }, 'image/png');
  }
  var busy = false;
  function banner(text) {
    var b = document.getElementById('recBanner');
    if (!b) { b = document.createElement('div'); b.id = 'recBanner'; b.style.cssText = 'position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);z-index:120;background:rgba(200,30,30,.95);color:#fff;font:700 15px system-ui,sans-serif;padding:8px 16px;border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:none'; document.body.appendChild(b); }
    b.textContent = text; return b;
  }
  function record(sec, fps, maxW) {
    var u = ui(), cv = canvas(); busy = true;
    var sc = Math.min(1, maxW / cv.width), w = Math.max(2, Math.round(cv.width * sc)), h = Math.max(2, Math.round(cv.height * sc));
    var off = document.createElement('canvas'); off.width = w; off.height = h; var cx = off.getContext('2d', { willReadFrequently: true }), frames = [], n = Math.round(sec * fps), t0 = performance.now();
    var tick = function () {
      var el = (performance.now() - t0) / 1000; banner('● Aufnahme ' + Math.max(0, Math.ceil(sec - el)) + ' s');
      cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h); cx.drawImage(cv, 0, 0, w, h); frames.push(cx.getImageData(0, 0, w, h).data);
      if (frames.length < n) { var due = t0 + (frames.length) * 1000 / fps; setTimeout(tick, Math.max(0, due - performance.now())); } else finish();
    };
    var finish = function () {
      banner('Erzeuge GIF …');
      setTimeout(function () {
        var blob; try { blob = encodeGif(w, h, frames, Math.round(100 / fps)); } catch (e) { var bn = document.getElementById('recBanner'); if (bn) bn.remove(); busy = false; u.toast('GIF konnte nicht erzeugt werden'); return; }
        var bn2 = document.getElementById('recBanner'); if (bn2) bn2.remove(); busy = false; result(blob, w, h, frames.length, sec, fps, maxW);
      }, 60);
    };
    setTimeout(tick, 50);
  }
  function result(blob, w, h, nf, sec, fps, maxW) {
    var u = ui(), url = URL.createObjectURL(blob);
    u.sheet('Animation fertig', function (b, close) {
      b.innerHTML = '<p style="margin-top:0">' + nf + ' Bilder, ' + w + ' × ' + h + ' Pixel, ' + (blob.size / 1024 / 1024).toFixed(2).replace('.', ',') + ' MB</p><img src="' + url + '" alt="Vorschau" style="max-width:100%;border-radius:10px;border:1px solid var(--line,#38424d)"><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn pri" id="gifSave">Speichern / Teilen</button><button class="btn" id="gifAgain">Neu aufnehmen</button></div><p class="hint2">Auf dem iPad: „Speichern / Teilen“ → „Bild sichern“ oder „In Dateien sichern“.</p>';
      b.querySelector('#gifSave').onclick = function () { saveBlob(blob, fname('gif')); };
      b.querySelector('#gifAgain').onclick = function () { close(); setTimeout(gif, 250); };
    });
  }
  function gif() {
    var u = ui(); if (busy) return;
    if (!canvas()) { u.toast('Keine Zeichenfläche gefunden'); return; }
    if (!simOn()) { u.toast('Schalte erst auf „Sim“, damit die Simulation läuft, dann nimm die Animation auf'); return; }
    u.sheet('Animation als GIF aufnehmen', function (b, close) {
      b.innerHTML = '<p style="margin-top:0">Die laufende Simulation wird als kurzer Film (GIF) aufgenommen, zum Beispiel für Berichte, Präsentationen und Chats. Stelle die Schaltung vorher so ein, wie sie gezeigt werden soll (Schalter, Regler, Tempo, Ausschnitt).</p>' +
        '<label class="f"><span>Dauer</span><select id="gDur"><option value="3">3 Sekunden</option><option value="5" selected>5 Sekunden</option><option value="8">8 Sekunden</option><option value="12">12 Sekunden</option></select></label>' +
        '<label class="f"><span>Größe</span><select id="gSize"><option value="480">klein (480 Pixel breit)</option><option value="720" selected>mittel (720 Pixel breit)</option><option value="1000">groß (1000 Pixel breit)</option></select></label>' +
        '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="gGo">Aufnahme starten</button></div><p class="hint2">Nach dem Start schließt sich das Fenster. Oben erscheint ein roter Zähler.</p>';
      b.querySelector('#gGo').onclick = function () { var sec = +b.querySelector('#gDur').value, mw = +b.querySelector('#gSize').value; close(); setTimeout(function () { record(sec, 8, mw); }, 450); };
    });
  }
  window.LabExport = { png: png, gif: gif, saveBlob: saveBlob, fname: fname, encodeGif: encodeGif };
})();
