/* loesungen-crypto.js - Entschluesselung der Loesungsdateien (WebCrypto), gemeinsam fuer loesungen.html und die Node-Tests.
 * Format Version 1:  [1 Byte Version=1][16 Byte Salt][12 Byte IV][Ciphertext + 16 Byte GCM-Tag]
 * Schluessel: PBKDF2-HMAC-SHA256, 600000 Iterationen, 32 Byte -> AES-256-GCM. Das Versionsbyte ist als AAD gebunden.
 * Das Passwort wird nie gespeichert: importPw() macht daraus einen nicht exportierbaren Schluessel-Rohstoff. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LoesCrypto = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 1, ITER = 600000, SALT = 16, IV = 12, TAG = 16;
  function subtle() {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : null;
    if (!c || !c.subtle) throw new Error('WEBCRYPTO');
    return c;
  }
  /* Passwort (String) -> nicht exportierbarer PBKDF2-Basisschluessel */
  async function importPw(pw) {
    return subtle().subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveKey']);
  }
  async function aesKey(base, salt, usage) {
    return subtle().subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: ITER }, base,
      { name: 'AES-GCM', length: 256 }, false, [usage]);
  }
  async function encrypt(base, data) {
    var c = subtle(), salt = c.getRandomValues(new Uint8Array(SALT)), iv = c.getRandomValues(new Uint8Array(IV));
    var key = await aesKey(base, salt, 'encrypt');
    var ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: new Uint8Array([VERSION]), tagLength: 128 }, key, data));
    var out = new Uint8Array(1 + SALT + IV + ct.length);
    out[0] = VERSION; out.set(salt, 1); out.set(iv, 1 + SALT); out.set(ct, 1 + SALT + IV);
    return out;
  }
  /* wirft bei jedem Fehler (falsches Passwort, Manipulation, falsches Format) denselben knappen Fehler 'ENTSCHLUESSELUNG' */
  async function decrypt(base, bytes) {
    try {
      if (!(bytes instanceof Uint8Array) || bytes.length < 1 + SALT + IV + TAG || bytes[0] !== VERSION) throw 0;
      var salt = bytes.slice(1, 1 + SALT), iv = bytes.slice(1 + SALT, 1 + SALT + IV), ct = bytes.slice(1 + SALT + IV);
      var key = await aesKey(base, salt, 'decrypt');
      return new Uint8Array(await subtle().subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: new Uint8Array([VERSION]), tagLength: 128 }, key, ct));
    } catch (e) { throw new Error('ENTSCHLUESSELUNG'); }
  }
  async function sha256hex(data) {
    var d = new Uint8Array(await subtle().subtle.digest('SHA-256', data)), s = '';
    for (var i = 0; i < d.length; i++) s += (d[i] < 16 ? '0' : '') + d[i].toString(16);
    return s;
  }
  /* Index entschluesseln und pruefen: { v:1, eintraege:[{id,name,titel,gruppe,typ,groesse,sha256}] } */
  async function decryptIndex(base, bytes) {
    var raw = await decrypt(base, bytes), obj;
    try { obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch (e) { throw new Error('ENTSCHLUESSELUNG'); }
    if (!obj || obj.v !== 1 || !Array.isArray(obj.eintraege)) throw new Error('ENTSCHLUESSELUNG');
    obj.eintraege = obj.eintraege.filter(function (e) {
      return e && /^[0-9a-f]{16}$/.test(e.id) && typeof e.titel === 'string' && (e.typ === 'pdf' || e.typ === 'html');
    });
    return obj;
  }
  /* Eine Datei laden, entschluesseln und gegen Groesse und Hash des Index pruefen */
  async function openEntry(base, entry, fetchBytes) {
    var plain = await decrypt(base, await fetchBytes('loesungen/' + entry.id + '.enc'));
    if (plain.length !== entry.groesse || (await sha256hex(plain)) !== entry.sha256) throw new Error('ENTSCHLUESSELUNG');
    return plain;
  }
  return { VERSION: VERSION, ITER: ITER, SALT: SALT, IV: IV, TAG: TAG, importPw: importPw, encrypt: encrypt, decrypt: decrypt, sha256hex: sha256hex, decryptIndex: decryptIndex, openEntry: openEntry };
});
