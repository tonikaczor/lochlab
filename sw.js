const CACHE = 'lochlab-v5.115';
const FILES = ['./', './index.html', './layout.html', './schaltplan.html', './simlab.html', './codelab.html', './arduino.js', './pyrun.js', './mcuio.js', './lochtasks.js', './keys.js', './rechner.js', './auswertung.js', './panels.js', './export.js', './badges.js', './predict.js', './speak.js', './tonwerkstatt.js', './neu.js', './trainer.js', './loetuebung.js', './oszi.js', './voice.js', './feel.js', './kampagne.js', './hdr.js', './qr.js', './jsqr.js', './auswertung.html', './aufgaben.js', './pruefplatz.js', './ver.js', './pilab.html', './beispiele.js', './anleitung.html', './lernen.html', './lernen-arduino.html', './projekt-ampel.html', './projekt-daemmerung.html', './projekt-netzteil.html', './lernen-loch.html', './lernen-schalt.html', './lernen-sim.html', './lernen-pi.html', './pi-sd-karte.html', './ausbilder.html', './lochbeispiele.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './logo.png', './logo-full.png', './fx.js', './simics.js', './simcore.js', './simui.js', './schaltplan.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Netz zuerst (damit Updates ankommen), sonst Cache -> funktioniert offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
