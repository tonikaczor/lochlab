'use strict';
/* Tonfunk Linux-Terminal-Lab: Kern (Kennung 'lin'). window.LIN_CORE bzw. module.exports.
   REIN SIMULIERT: Es gibt ein virtuelles Dateisystem im Speicher und einen kleinen Befehlsinterpreter in JavaScript.
   Nichts davon läuft auf dem echten Rechner: kein Dateizugriff, kein Prozess, kein Netzwerk.
   Unterstützt: Pipes |, Umleitung > >> < 2> 2>&1, ; && || und & (Hintergrund), $VAR, $(...), * ? und ~.
   Befehle und Syntaxfehler liefern immer Meldungen im Stil der echten Bash (englisch, wie auf einem Server),
   dazu einen deutschen Hinweis (hints). Es werden nie Exceptions nach außen geworfen. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch (wie in den anderen Labs) ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|mal|mb|kb|gb|%|prozent|zeilen|zeile|minuten|sekunden|uhr)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, fr] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (fr) fr = fr.replace(/0+$/, '');
    return (neg ? '−' : '') + i + (fr ? ',' + fr : '');
  }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }
  const NL = String.fromCharCode(10);
  const enc = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length);

  /* ---------- Deutsche Hinweise zu Fehlermeldungen ---------- */
  /* PRUEFEN P1: Fehlermeldungen der Befehle sind englisch (wie auf einem Server, Ubuntu-Stil), dazu kommt ein deutscher Hinweis. Soll das so bleiben oder soll das ... */
  const HINT = {
    ENOENT: 'Hinweis: Den Pfad gibt es nicht. Prüfe mit pwd, wo du bist, und mit ls, was dort liegt. Groß- und Kleinschreibung zählt.',
    EACCES: 'Hinweis: Dir fehlt die Berechtigung. Mit ls -l siehst du die Rechte. Hilft chmod, gehört die Datei jemand anderem, oder brauchst du sudo?',
    ENOTDIR: 'Hinweis: Ein Teil des Pfades ist eine Datei, kein Ordner.',
    EISDIR: 'Hinweis: Das ist ein Ordner. Dieser Befehl braucht hier eine Datei (oder bei rm/cp die Option -r).',
    EEXIST: 'Hinweis: Das gibt es schon. Für verschachtelte Ordner hilft mkdir -p (legt fehlende Ordner an, meldet keinen Fehler).',
    ENOTEMPTY: 'Hinweis: Der Ordner ist nicht leer. rmdir löscht nur leere Ordner; rm -r löscht den Ordner samt Inhalt (endgültig, es gibt keinen Papierkorb).',
    EPERM: 'Hinweis: Das darf nur der Besitzer oder root. Mit sudo führst du den Befehl als Administrator aus.',
    NOCMD: 'Hinweis: Den Befehl gibt es nicht (Tippfehler?). Mit help siehst du die Befehle dieses Labs.',
    OPT: 'Hinweis: Diese Option kennt der Befehl nicht. Mit befehl --help siehst du die erlaubten Optionen.',
    USAGE: 'Hinweis: Es fehlt ein Argument oder es ist falsch aufgebaut. Mit befehl --help siehst du den Aufbau.',
    SYNTAX: 'Hinweis: Vor oder nach dem Sonderzeichen fehlt etwas, oder eine Anführungszeichen-Klammer ist nicht geschlossen.',
    NOPKG: 'Hinweis: Das Paket gibt es in der Paketliste nicht. Mit apt search suchst du nach Paketnamen.',
    LOCK: 'Hinweis: Paketverwaltung braucht Administratorrechte: sudo davor setzen.',
    NOSUDO: 'Hinweis: Dieser Benutzer steht nicht in der Gruppe sudo und darf sudo nicht nutzen.',
    SIM: 'Hinweis: Dieses Programm wird im Lab nicht simuliert. Im echten Terminal funktioniert es.',
    SVCAUTH: 'Hinweis: Dienste starten, stoppen, aktivieren oder deaktivieren darf nur der Administrator. Setze sudo davor. Lesen (status, list-units, is-active) geht auch ohne.',
    NOUNIT: 'Hinweis: Diesen Dienst kennt systemd nicht (Tippfehler oder nicht installiert). systemctl list-units --type=service --all zeigt die vorhandenen Dienste.',
    AWKSIM: 'Hinweis: Das Lab simuliert awk nur in einfacher Form: print mit $1, $2, $NF, NR, -F Trenner, Muster wie /text/ oder NR==2 und Summen mit END. Im echten Terminal kann awk deutlich mehr.',
    SEDSIM: 'Hinweis: Das Lab simuliert sed nur in einfacher Form: s/alt/neu/ (mit g), p, d, q mit Zeilennummern oder /muster/ als Adresse, dazu -n, -e, -E und -i. Im echten Terminal kann sed deutlich mehr.'
  };
  const ETXT = { ENOENT: 'No such file or directory', EACCES: 'Permission denied', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory', EEXIST: 'File exists', ENOTEMPTY: 'Directory not empty', EPERM: 'Operation not permitted' };

  /* ---------- Rechte ---------- */
  const rwx = b => (b & 4 ? 'r' : '-') + (b & 2 ? 'w' : '-') + (b & 1 ? 'x' : '-');
  function modeSym(m) {
    const t = (sh, sp, ch) => { const b = (m >> sh) & 7, x = b & 1; let xs; if (m & sp) xs = x ? ch : ch.toUpperCase(); else xs = x ? 'x' : '-'; return (b & 4 ? 'r' : '-') + (b & 2 ? 'w' : '-') + xs; };
    return t(6, 0o4000, 's') + t(3, 0o2000, 's') + t(0, 0o1000, 't');
  }
  const modeOct = m => { m &= 0o7777; const s = m.toString(8); return m > 0o777 ? s.padStart(4, '0') : s.padStart(3, '0'); };
  /* "rwxr-x--x" -> 0o751 (nur r, w, x, -; sonst NaN) */
  function symToMode(s) {
    if (typeof s !== 'string' || !/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/.test(s)) return NAN;
    let m = 0; for (let i = 0; i < 9; i++) if (s[i] !== '-') m |= 1 << (8 - i); return m;
  }
  /* chmod-Angabe anwenden: Oktalzahl (1 bis 4 Ziffern) oder symbolisch (u+x,g-w,o=r,a+rw ...); null bei Fehler */
  function applyChmod(spec, mode, isDir, umask) {
    if (/^[0-7]{1,4}$/.test(spec)) return parseInt(spec, 8);
    if (!spec) return null;
    let m = mode & 0o7777;
    for (const cl of spec.split(',')) {
      const mt = /^([ugoa]*)([+\-=])([rwxXst]*)$/.exec(cl); if (!mt) return null;
      let who = mt[1], op = mt[2], perm = mt[3]; const noWho = !who; if (noWho) who = 'a'; if (who.includes('a')) who = 'ugo';
      let b = 0; if (perm.includes('r')) b |= 4; if (perm.includes('w')) b |= 2; if (perm.includes('x')) b |= 1; if (perm.includes('X') && (isDir || (m & 0o111))) b |= 1;
      let bits = 0, clr = 0;
      for (const w of who) { const sh = w === 'u' ? 6 : w === 'g' ? 3 : 0; bits |= b << sh; clr |= 7 << sh; if (perm.includes('s') && w === 'u') bits |= 0o4000; if (perm.includes('s') && w === 'g') bits |= 0o2000; if (perm.includes('t')) bits |= 0o1000; }
      if (noWho && umask != null && op !== '-') bits &= ~umask; else if (noWho && umask != null) bits &= ~umask;
      if (op === '+') m |= bits; else if (op === '-') m &= ~bits; else { m &= ~clr; if (who.includes('u')) m &= ~0o4000; if (who.includes('g')) m &= ~0o2000; m |= bits; }
    }
    return m & 0o7777;
  }

  /* ---------- Dateisystem ---------- */
  /* PRUEFEN P3: Alle Dateien tragen das feste Datum 8. Nov 09:30 (Zeitzone CET, englische Monatskürzel wie ls -l auf Servern). Ist das für den Unterricht ausreichend? */
  const NOW = 'Nov  8 09:30';
  const mkNode = (t, mode, owner, group, content, mt) => ({ t, mode, owner, group, mt: mt || NOW, content: t === 'f' ? (content || '') : undefined, ch: t === 'd' ? {} : undefined });
  const parts = p => p.split('/').filter(Boolean);
  const dirname = p => { const a = parts(p); a.pop(); return '/' + a.join('/'); };
  const basename = p => { const a = parts(p); return a.length ? a[a.length - 1] : '/'; };
  const joinP = (d, n) => (d === '/' ? '' : d) + '/' + n;
  function norm(sys, p) {
    p = String(p);
    if (p === '~' || p.startsWith('~/')) { const u = sys.users[sys.user]; p = (u ? u.home : '/') + p.slice(1); }
    if (!p.startsWith('/')) p = sys.cwd + '/' + p;
    const out = []; for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') { out.pop(); continue; } out.push(s); }
    return '/' + out.join('/');
  }
  function inGroup(sys, user, group) { const u = sys.users[user]; return !!(u && u.groups.includes(group)); }
  /* bit: 4 lesen, 2 schreiben, 1 ausführen/betreten */
  function can(sys, n, user, bit) {
    if (user === 'root') return bit !== 1 || n.t === 'd' || (n.mode & 0o111) !== 0;
    const sh = n.owner === user ? 6 : inGroup(sys, user, n.group) ? 3 : 0;
    return ((n.mode >> sh) & bit) !== 0;
  }
  function walk(sys, abs, user) {
    let cur = sys.fs; const ps = parts(abs);
    for (let i = 0; i < ps.length; i++) {
      if (cur.t !== 'd') return { err: 'ENOTDIR' };
      if (!can(sys, cur, user, 1)) return { err: 'EACCES' };
      const nx = cur.ch[ps[i]]; if (!nx) return { err: 'ENOENT' }; cur = nx;
    }
    return { n: cur, abs };
  }
  function parentOf(sys, abs, user) {
    if (abs === '/') return { err: 'EEXIST' };
    const w = walk(sys, dirname(abs), user); if (w.err) return w; if (w.n.t !== 'd') return { err: 'ENOTDIR' };
    return { dir: w.n, name: basename(abs), dpath: dirname(abs) };
  }
  const primGroup = (sys, user) => { const u = sys.users[user]; return u ? u.groups[0] : 'root'; };
  function canDelete(sys, dir, node, user) {
    if (!can(sys, dir, user, 2) || !can(sys, dir, user, 1)) return false;
    if ((dir.mode & 0o1000) && user !== 'root' && node.owner !== user && dir.owner !== user) return false;
    return true;
  }
  function cloneNode(n, owner, group, umask) {
    const c = { t: n.t, mode: umask == null ? n.mode : (n.mode & ~umask & 0o7777), owner, group, mt: NOW };
    if (n.t === 'f') { c.content = n.content; if (n.sim) c.sim = n.sim; } else { c.ch = {}; for (const k of Object.keys(n.ch)) c.ch[k] = cloneNode(n.ch[k], owner, group, umask); }
    return c;
  }
  /* Eintrag anlegen: {p, t:'f'|'d', m, o, g, c, sim, mt}; fehlende Elternordner werden angelegt */
  function put(sys, e) {
    const ps = parts(e.p); let cur = sys.fs;
    for (let i = 0; i < ps.length - 1; i++) { if (!cur.ch[ps[i]]) cur.ch[ps[i]] = mkNode('d', 0o755, e.o || 'root', e.g || 'root'); cur = cur.ch[ps[i]]; }
    if (!ps.length) return sys.fs;
    const n = mkNode(e.t || 'f', e.m != null ? e.m : (e.t === 'd' ? 0o755 : 0o644), e.o || 'root', e.g || 'root', e.c, e.mt);
    if (e.sim != null) n.sim = e.sim; if (e.dev) n.dev = e.dev;
    cur.ch[ps[ps.length - 1]] = n; return n;
  }
  const getNode = (sys, p) => { const w = walk(sys, norm(sys, p), 'root'); return w.n || null; };
  const readText = (sys, p) => { const n = getNode(sys, p); return n && n.t === 'f' ? n.content : null; };
  const modeOf = (sys, p) => { const n = getNode(sys, p); return n ? modeOct(n.mode) : null; };
  const listDir = (sys, p) => { const n = getNode(sys, p); return n && n.t === 'd' ? Object.keys(n.ch).sort() : null; };
  const exists = (sys, p) => !!getNode(sys, p);

  /* ---------- Konten ---------- */
  function syncAccounts(sys) {
    const U = Object.keys(sys.users).sort((a, b) => sys.users[a].uid - sys.users[b].uid);
    const pw = U.map(n => { const u = sys.users[n]; return [n, 'x', u.uid, sys.groups[u.groups[0]] != null ? sys.groups[u.groups[0]] : u.uid, u.gecos || '', u.home, u.shell || '/bin/bash'].join(':'); }).join('\n') + '\n';
    const G = Object.keys(sys.groups).sort((a, b) => sys.groups[a] - sys.groups[b]);
    const gr = G.map(g => [g, 'x', sys.groups[g], U.filter(n => sys.users[n].groups.slice(1).includes(g)).join(',')].join(':')).join('\n') + '\n';
    const a = getNode(sys, '/etc/passwd'), b = getNode(sys, '/etc/group');
    if (a) a.content = pw; else put(sys, { p: '/etc/passwd', m: 0o644, c: pw });
    if (b) b.content = gr; else put(sys, { p: '/etc/group', m: 0o644, c: gr });
  }

  /* ---------- System ---------- */
  const DEF_USERS = [{ n: 'root', uid: 0, home: '/root', groups: ['root'], gecos: 'root' }, { n: 'azubi', uid: 1000, home: '/home/azubi', groups: ['azubi', 'sudo'], gecos: 'Azubi' }];
  /* Dienste (systemctl): n Name, alias, d Beschreibung, on läuft, en beim Start aktiviert, pid/exe/cmd Hauptprozess, worker Kindprozess, sysv Dienst mit SysV-Skript, broken startet nicht */
  const DEF_SVC = [
    { n: 'ssh', alias: ['sshd'], d: 'OpenBSD Secure Shell server', on: true, en: true, pid: 688, exe: 'sshd', cmd: 'sshd: /usr/sbin/sshd -D', sysv: true, since: 'Thu 2026-11-05 09:12:41 CET; 3 days ago' },
    { n: 'cron', alias: [], d: 'Regular background program processing daemon', on: true, en: true, pid: 531, exe: 'cron', cmd: '/usr/sbin/cron -f', sysv: true, since: 'Thu 2026-11-05 09:12:40 CET; 3 days ago' },
    { n: 'nginx', alias: [], d: 'A high performance web server and a reverse proxy server', on: true, en: true, pid: 745, exe: 'nginx', cmd: 'nginx: master process /usr/sbin/nginx', worker: { user: 'www-data', cmd: 'nginx: worker process' }, sysv: true, since: 'Thu 2026-11-05 10:02:20 CET; 3 days ago' },
    { n: 'rsyslog', alias: ['syslog'], d: 'System Logging Service', on: true, en: true, pid: 412, exe: 'rsyslogd', cmd: '/usr/sbin/rsyslogd -n -iNONE', user: 'syslog', since: 'Thu 2026-11-05 09:12:39 CET; 3 days ago' },
    { n: 'fail2ban', alias: [], d: 'Fail2Ban Service', on: false, en: false, pid: 0, exe: 'fail2ban-server', cmd: '/usr/bin/python3 /usr/bin/fail2ban-server -xf start' }
  ];
  function newSystem(spec) {
    spec = spec || {};
    const sys = { fs: mkNode('d', 0o755, 'root', 'root'), cwd: spec.cwd || '/home/azubi', user: spec.user || 'azubi', host: spec.host || 'tonfunk-pc', users: {}, groups: {}, procs: [], jobs: [], notices: [], nextPid: 3100, nextJob: 1, umask: 0o022, lastCode: 0, hist: [], sudoSeen: false, oldpwd: null,
      pkgs: { inst: {}, avail: {}, updated: false }, net: null, sockets: [], cron: '', rec: { cmds: [], items: [], outs: [] }, env: {} };
    (spec.users || DEF_USERS).forEach(u => { sys.users[u.n] = { uid: u.uid, home: u.home, groups: u.groups.slice(), gecos: u.gecos || '', shell: u.shell || '/bin/bash' }; });
    const gl = spec.groups || {}; Object.keys(gl).forEach(g => { sys.groups[g] = gl[g]; });
    Object.keys(sys.users).forEach(n => { sys.users[n].groups.forEach(g => { if (sys.groups[g] == null) sys.groups[g] = g === n ? sys.users[n].uid : 100 + Object.keys(sys.groups).length; }); });
    (spec.files || []).forEach(e => put(sys, e));
    syncAccounts(sys);
    if (!getNode(sys, '/tmp')) put(sys, { p: '/tmp', t: 'd', m: 0o1777 });
    if (!getNode(sys, '/dev/null')) put(sys, { p: '/dev/null', m: 0o666, dev: 'null' });
    Object.keys(sys.users).forEach(n => { const h = sys.users[n].home; if (!/nologin/.test(sys.users[n].shell) && !getNode(sys, h)) put(sys, { p: h, t: 'd', m: 0o755, o: n, g: sys.users[n].groups[0] }); });
    if (spec.procs) sys.procs = spec.procs.map(p => Object.assign({ ppid: 1, cpu: 0, mem: 0.1, vsz: 10000, rss: 3000, tty: '?', stat: 'Ss', start: 'Nov05', time: '0:00' }, p));
    if (spec.pkgs) { sys.pkgs.inst = Object.assign({}, spec.pkgs.inst); sys.pkgs.avail = Object.assign({}, spec.pkgs.avail); }
    sys.net = spec.net || { ip: '192.168.10.25', prefix: 24, gw: '192.168.10.1', hosts: { localhost: '127.0.0.1', '127.0.0.1': '127.0.0.1' }, down: [] };
    sys.sockets = spec.sockets || []; sys.cron = spec.cron || '';
    sys.svc = {}; (spec.svc || DEF_SVC).forEach(s => { sys.svc[s.n] = Object.assign({ alias: [], sock: [] }, s); });
    sys.env = Object.assign({ HOME: sys.users[sys.user] ? sys.users[sys.user].home : '/', USER: sys.user, SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'en_US.UTF-8', HOSTNAME: sys.host, TERM: 'xterm' }, spec.env || {});
    Object.keys(CMDS).forEach(n => { if (!CMDS[n].pkg && !CMDS[n].bi && !getNode(sys, '/usr/bin/' + n)) put(sys, { p: '/usr/bin/' + n, m: 0o755, c: '' }); });
    return sys;
  }
  const prompt = sys => { const u = sys.users[sys.user], h = u ? u.home : '/'; let d = sys.cwd; if (d === h) d = '~'; else if (d.startsWith(h + '/')) d = '~' + d.slice(h.length); return sys.user + '@' + sys.host + ':' + d + (sys.user === 'root' ? '# ' : '$ '); };

  /* ---------- Hilfsfunktionen für Ausgabe ---------- */
  const human = n => { if (n < 1024) return String(n); const u = ['K', 'M', 'G']; let v = n / 1024, i = 0; while (v >= 1024 && i < 2) { v /= 1024; i++; } return (v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + u[i]; };
  /* PRUEFEN P2: Sortierreihenfolge von sort und ls ignoriert Groß- und Kleinschreibung (wie en_US.UTF-8 auf Ubuntu). In der C-Locale kämen Großbuchstaben zuerst. W... */
  const lcmp = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : a === b ? 0 : (a > b ? -1 : 1); };
  const lsKey = s => s.replace(/^\./, '').toLowerCase();
  const lsCmp = (a, b) => { const x = lsKey(a), y = lsKey(b); return x < y ? -1 : x > y ? 1 : (a < b ? -1 : a > b ? 1 : 0); };
  const sizeOf = n => (n.t === 'd' ? 4096 : enc(n.content || ''));
  const textLines = s => { if (!s) return []; const a = s.split('\n'); if (a[a.length - 1] === '') a.pop(); return a; };
  const linesText = a => (a.length ? a.join('\n') + '\n' : '');
  const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);

  /* ---------- Muster (Glob) ---------- */
  function globRe(p) {
    let s = '^'; for (let i = 0; i < p.length; i++) { const ch = p[i]; if (ch === '*') s += '[^/]*'; else if (ch === '?') s += '[^/]'; else if (ch === '[') { const j = p.indexOf(']', i + 2); if (j > 0) { s += '[' + p.slice(i + 1, j).replace(/^!/, '^').replace(/\\/g, '\\\\') + ']'; i = j; } else s += '\\['; } else s += ch.replace(/[.+^${}()|\\\/]/g, '\\$&'); }
    return new RegExp(s + '$');
  }
  function globExpand(sys, pat, user) {
    const abs = pat.startsWith('/'); const segs = pat.split('/'); let bases = [abs ? '/' : ''];
    for (let i = abs ? 1 : 0; i < segs.length; i++) {
      const sg = segs[i], nb = []; if (sg === '') continue;
      for (const b of bases) {
        if (!/[*?\[]/.test(sg)) { nb.push(b === '' ? sg : (b === '/' ? '/' + sg : b + '/' + sg)); continue; }
        const dp = b === '' ? sys.cwd : norm(sys, b), w = walk(sys, dp, user); if (!w.n || w.n.t !== 'd' || !can(sys, w.n, user, 4)) continue;
        const re = globRe(sg); Object.keys(w.n.ch).sort(lsCmp).forEach(k => { if (k[0] === '.' && sg[0] !== '.') return; if (re.test(k)) nb.push(b === '' ? k : (b === '/' ? '/' + k : b + '/' + k)); });
      }
      bases = nb;
    }
    return bases.filter(b => b !== '' && walk(sys, norm(sys, b), user).n);
  }

  /* ---------- Shell: Zerlegen ---------- */
  function tokenize(line) {
    const toks = []; let cur = null, i = 0; const n = line.length;
    const push = () => { if (cur) { toks.push({ w: cur }); cur = null; } };
    const add = (s, q) => { if (!cur) cur = []; const l = cur[cur.length - 1]; if (l && l.q === q) l.s += s; else cur.push({ s, q }); };
    const matchParen = (j) => { let d = 0; for (let k = j; k < n; k++) { if (line[k] === '(') d++; else if (line[k] === ')') { d--; if (d === 0) return k; } } return -1; };
    while (i < n) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t') { push(); i++; continue; }
      if (ch === '#' && !cur) break;
      if (ch === "'") { const j = line.indexOf("'", i + 1); if (j < 0) return { err: "unexpected EOF while looking for matching `''" }; add(line.slice(i + 1, j), 's'); i = j + 1; continue; }
      if (ch === '"') {
        let j = i + 1, buf = ''; cur = cur || [];
        for (; j < n; j++) {
          const c2 = line[j];
          if (c2 === '\\' && j + 1 < n && '"\\$`'.includes(line[j + 1])) { buf += line[j + 1] === '$' ? '\u0001' : line[j + 1]; j++; continue; }
          if (c2 === '$' && line[j + 1] === '(') { const k = matchParen(j + 1); if (k < 0) return { err: 'unexpected EOF while looking for matching `)\'' }; buf += line.slice(j, k + 1); j = k; continue; }
          if (c2 === '"') break; buf += c2;
        }
        if (j >= n) return { err: 'unexpected EOF while looking for matching `"\'' };
        add(buf, 'd'); i = j + 1; continue;
      }
      if (ch === '\\') { if (i + 1 < n) { add(line[i + 1], 's'); i += 2; } else { i++; } continue; }
      if (ch === '`') { const j = line.indexOf('`', i + 1); if (j < 0) return { err: 'unexpected EOF while looking for matching ``\'' }; add('$(' + line.slice(i + 1, j) + ')', 'n'); i = j + 1; continue; }
      if (ch === '$' && line[i + 1] === '(') { const k = matchParen(i + 1); if (k < 0) return { err: 'unexpected EOF while looking for matching `)\'' }; add(line.slice(i, k + 1), 'n'); i = k + 1; continue; }
      if (ch === '|') { push(); if (line[i + 1] === '|') { toks.push({ op: '||' }); i += 2; } else { toks.push({ op: '|' }); i++; } continue; }
      if (ch === '&') { push(); if (line[i + 1] === '&') { toks.push({ op: '&&' }); i += 2; } else { toks.push({ op: '&' }); i++; } continue; }
      if (ch === ';') { push(); toks.push({ op: ';' }); i++; continue; }
      if (ch === '<') { push(); toks.push({ op: '<' }); i++; continue; }
      if (ch === '>') {
        let fd = 1;
        if (cur && cur.length === 1 && cur[0].q === 'n' && (cur[0].s === '2' || cur[0].s === '1')) { fd = +cur[0].s; cur = null; } else push();
        if (line[i + 1] === '>') { toks.push({ op: '>>', fd }); i += 2; } else if (line[i + 1] === '&' && /^[12]/.test(line.slice(i + 2, i + 3))) { toks.push({ op: '>&', fd, to: +line[i + 2] }); i += 3; } else { toks.push({ op: '>', fd }); i++; }
        continue;
      }
      if (ch === '(' || ch === ')') return { err: null, syntax: ch };
      add(ch, 'n'); i++;
    }
    push(); return { toks };
  }
  /* Tokens -> Liste von {pipe:[stage], op, bg}; stage {words, redirs} */
  function parse(toks) {
    const items = []; let stage = { words: [], redirs: [] }, pipe = [];
    const bad = t => ({ err: "syntax error near unexpected token `" + t + "'" });
    const empty = s => !s.words.length && !s.redirs.length;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.w) { stage.words.push(t.w); continue; }
      const o = t.op;
      if (o === '>' || o === '>>' || o === '<') { const nx = toks[i + 1]; if (!nx || !nx.w) return bad(nx ? nx.op : 'newline'); stage.redirs.push({ op: o, fd: t.fd || (o === '<' ? 0 : 1), target: nx.w }); i++; continue; }
      if (o === '>&') { stage.redirs.push({ op: '>&', fd: t.fd, to: t.to }); continue; }
      if (o === '|') { if (empty(stage)) return bad('|'); pipe.push(stage); stage = { words: [], redirs: [] }; continue; }
      if (o === '&&' || o === '||' || o === ';' || o === '&') {
        if (empty(stage)) { if (o === '&' && !pipe.length) return bad('&'); if (pipe.length || o !== ';' || true) return bad(o); }
        pipe.push(stage); stage = { words: [], redirs: [] };
        items.push({ pipe, op: o === '&' ? ';' : o, bg: o === '&' }); pipe = [];
      }
    }
    if (!empty(stage)) { pipe.push(stage); items.push({ pipe, op: ';', bg: false }); } else if (pipe.length) return bad('newline');
    return { items };
  }

  /* ---------- Shell: Ausführen ---------- */
  function expandText(sys, text, ctx) {
    let out = '', i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '$') {
        const nx = text[i + 1];
        if (nx === '(') { let d = 0, k = i + 1; for (; k < text.length; k++) { if (text[k] === '(') d++; else if (text[k] === ')') { d--; if (d === 0) break; } } const sub = text.slice(i + 2, k); out += ctx.sub(sub); i = k + 1; continue; }
        if (nx === '?') { out += String(sys.lastCode); i += 2; continue; }
        if (nx === '$') { out += '1201'; i += 2; continue; }
        if (nx === '{') { const k = text.indexOf('}', i); if (k > 0) { out += sys.env[text.slice(i + 2, k)] || ''; i = k + 1; continue; } }
        const m = /^[A-Za-z_]\w*/.exec(text.slice(i + 1)); if (m) { out += sys.env[m[0]] || ''; i += 1 + m[0].length; continue; }
        if (/\d/.test(nx || '')) { i += 2; continue; }
        out += '$'; i++; continue;
      }
      out += ch; i++;
    }
    return out;
  }
  function expandWord(sys, segs, ctx) {
    let text = '', glob = false;
    segs.forEach((sg, idx) => {
      if (sg.q === 's') { text += sg.s.replace(/[*?\[]/g, m => '\u0002' + m); return; }
      let s = sg.s;
      if (sg.q === 'n' && idx === 0 && s[0] === '~' && (s.length === 1 || s[1] === '/' || /^~\w+(\/|$)/.test(s))) {
        const m = /^~(\w*)/.exec(s), u = m[1] ? sys.users[m[1]] : sys.users[sys.user]; if (u) s = u.home + s.slice(m[0].length);
      }
      s = expandText(sys, s, ctx);
      if (sg.q === 'n') { if (/[*?\[]/.test(sg.s)) glob = true; text += s; } else text += s.replace(/[*?\[]/g, m => '\u0002' + m);
    });
    return { text, glob };
  }
  const unesc = s => s.replace(/\u0002/g, '').replace(/\u0001/g, '$');

  function runLine(sys, line, R, user) {
    const tk = tokenize(line);
    if (tk.syntax) { R.items.push({ k: 'e', s: "bash: syntax error near unexpected token `" + tk.syntax + "'" }); R.hints.push(HINT.SYNTAX); return 2; }
    if (tk.err) { R.items.push({ k: 'e', s: 'bash: ' + tk.err }); R.hints.push(HINT.SYNTAX); return 2; }
    if (!tk.toks.length) return sys.lastCode;
    const ps = parse(tk.toks);
    if (ps.err) { R.items.push({ k: 'e', s: 'bash: ' + ps.err }); R.hints.push(HINT.SYNTAX); return 2; }
    let code = 0, prevOp = ';';
    for (const it of ps.items) {
      if ((prevOp === '&&' && code !== 0) || (prevOp === '||' && code === 0)) { prevOp = it.op; continue; }
      code = runPipeline(sys, it.pipe, R, user, it.bg); sys.lastCode = code; prevOp = it.op;
    }
    return code;
  }
  const BG_KEEP = c => c === 'sleep' || c === 'top' || c === 'watch';
  function runPipeline(sys, pipe, R, user, bg) {
    let input = '', code = 0;
    const sub = s => { const R2 = { items: [], hints: R.hints, stdout: '', sub: true }; runLine(sys, s, R2, user); R2.items.forEach(x => { if (x.k === 'e') R.items.push(x); }); return R2.items.filter(x => x.k === 'o').map(x => x.s).join('').replace(/\n+$/, ''); };
    const ctx = { sub };
    if (bg) {
      const w0 = pipe[0].words.map(w => unesc(expandWord(sys, w, ctx).text)); const name = w0[0];
      if (name && (BG_KEEP(name) || (name === 'ping' && !w0.includes('-c')) || (name === 'tail' && w0.includes('-f')))) {
        const pid = sys.nextPid++, n = sys.nextJob++, cmd = w0.join(' ');
        sys.procs.push({ pid, ppid: 1201, user, cpu: 0, mem: 0.1, vsz: 8000, rss: 1000, tty: 'pts/0', stat: 'S', start: '09:30', time: '0:00', cmd });
        sys.jobs.push({ n, pid, cmd }); R.items.push({ k: 'o', s: '[' + n + '] ' + pid + '\n' }); return 0;
      }
      R.items.push({ k: 'o', s: '[' + sys.nextJob + '] ' + (sys.nextPid++) + '\n' });
    }
    for (let i = 0; i < pipe.length; i++) {
      const st = pipe[i], last = i === pipe.length - 1;
      /* Wörter expandieren (Variablen, Glob) */
      const argv = [];
      for (const w of st.words) {
        const ex = expandWord(sys, w, ctx);
        if (ex.glob) { const g = globExpand(sys, ex.text.replace(/\u0002/g, ''), sys.user); if (g.length) { g.forEach(x => argv.push(x)); continue; } }
        argv.push(unesc(ex.text));
      }
      /* Zuweisung VAR=wert */
      if (argv.length && /^[A-Za-z_]\w*=/.test(argv[0]) && st.words[0][0].q === 'n') {
        let k = 0; while (k < argv.length && /^[A-Za-z_]\w*=/.test(argv[k])) { const eq = argv[k].indexOf('='); sys.env[argv[k].slice(0, eq)] = argv[k].slice(eq + 1); k++; }
        if (k === argv.length) { input = ''; code = 0; continue; } argv.splice(0, k);
      }
      /* Umleitungen öffnen (als echter Benutzer der Shell) */
      let stdin = input, outFile = null, errFile = null, err2out = false, out2err = false, failed = false;
      for (const r of st.redirs) {
        if (r.op === '>&') { if (r.fd === 2 && r.to === 1) err2out = true; else if (r.fd === 1 && r.to === 2) out2err = true; continue; }
        const tp = unesc(expandWord(sys, r.target, ctx).text);
        if (r.op === '<') {
          const w = walk(sys, norm(sys, tp), sys.user);
          if (w.err) { R.items.push({ k: 'e', s: 'bash: ' + tp + ': ' + ETXT[w.err] }); R.hints.push(HINT[w.err]); failed = true; break; }
          if (w.n.t === 'd') { R.items.push({ k: 'e', s: 'bash: ' + tp + ': ' + ETXT.EISDIR }); R.hints.push(HINT.EISDIR); failed = true; break; }
          if (!can(sys, w.n, sys.user, 4)) { R.items.push({ k: 'e', s: 'bash: ' + tp + ': ' + ETXT.EACCES }); R.hints.push(HINT.EACCES); failed = true; break; }
          stdin = w.n.content || ''; continue;
        }
        const f = openOut(sys, tp, r.op === '>>', sys.user);
        if (f.err) { R.items.push({ k: 'e', s: 'bash: ' + tp + ': ' + ETXT[f.err] }); R.hints.push(HINT[f.err]); failed = true; break; }
        if (r.fd === 2) errFile = f; else outFile = f;
      }
      if (failed) { code = 1; input = ''; if (last) return code; continue; }
      const chunks = [], tty = last && !outFile && !out2err;
      code = execCmd(sys, argv, stdin, user, tty, chunks, R);
      const errChunks = chunks.filter(x => x.k === 'e');
      let stdout = chunks.filter(x => x.k === 'o').map(x => x.s).join(''), toTermErr = errChunks;
      if (err2out) { stdout = chunks.map(x => (x.k === 'e' ? x.s + NL : x.s)).join(''); toTermErr = []; }
      else if (errFile) { if (!errFile.dev) errFile.node.content += errChunks.map(x => x.s + NL).join(''); toTermErr = []; }
      if (outFile) { if (!outFile.dev) outFile.node.content += stdout; stdout = ''; }
      if (out2err) { if (stdout) R.items.push({ k: 'e', s: stdout }); stdout = ''; }
      if (last && !outFile && !out2err && !err2out && !errFile) chunks.forEach(x => R.items.push(x));
      else { toTermErr.forEach(x => R.items.push(x)); if (last && stdout) R.items.push({ k: 'o', s: stdout }); }
      if (!last) input = stdout;
    }
    return code;
  }
  function openOut(sys, tp, append, user) {
    const abs = norm(sys, tp), w = walk(sys, abs, user);
    if (w.n) {
      if (w.n.t === 'd') return { err: 'EISDIR' };
      if (w.n.dev) return { dev: true, node: w.n };
      if (!can(sys, w.n, user, 2)) return { err: 'EACCES' };
      if (!append) w.n.content = ''; return { node: w.n };
    }
    if (w.err && w.err !== 'ENOENT') return { err: w.err };
    const p = parentOf(sys, abs, user); if (p.err) return { err: p.err };
    if (!can(sys, p.dir, user, 2)) return { err: 'EACCES' };
    const n = mkNode('f', 0o666 & ~sys.umask, user, primGroup(sys, user), ''); p.dir.ch[p.name] = n; return { node: n };
  }

  /* ---------- Befehle: Kontext ---------- */
  function execCmd(sys, argv, stdin, user, tty, chunks, R) {
    if (!argv.length) return 0;
    let name = argv[0];
    /* Pfadaufruf: ./skript, /usr/bin/ls */
    if (name.includes('/')) {
      const abs = norm(sys, name), bn = basename(abs);
      if (/^\/(usr\/)?(s?bin|usr\/local\/bin)\/[^/]+$/.test(abs) && CMDS[bn]) name = bn;
      else return runFile(sys, name, abs, argv, user, chunks, R);
    }
    const def = CMDS[name];
    if (!def) return notFound(sys, name, chunks, R);
    if (def.pkg && !sys.pkgs.inst[def.pkg]) { chunks.push({ k: 'e', s: "Command '" + name + "' not found, but can be installed with:\nsudo apt install " + def.pkg }); R.hints.push('Hinweis: Das Programm ist noch nicht installiert. Installieren geht mit sudo apt install ' + def.pkg + '.'); return 127; }
    const c = {
      sys, user, name, stdin, tty, args: argv.slice(1),
      o: s => { if (s) chunks.push({ k: 'o', s }); }, ln: s => chunks.push({ k: 'o', s: s + '\n' }),
      er: (s, h) => { chunks.push({ k: 'e', s }); if (h) R.hints.push(HINT[h] || h); },
      e: (s, h) => c.er(name + ': ' + s, h), hint: h => R.hints.push(h), R,
      fe: (code, pre, hk) => c.er(name + ': ' + pre + ': ' + ETXT[code], hk === undefined ? code : hk),
      abs: p => norm(sys, p), get: p => walk(sys, norm(sys, p), user), can: (n, b) => can(sys, n, user, b)
    };
    if (c.args.includes('--help') && USAGE[name]) { c.o(USAGE[name].replace(/^/, 'Usage: ') + '\n'); return 0; }
    try { const r = def.fn(c, c.args); return typeof r === 'number' ? r : 0; } catch (ex) { c.er('bash: interner Fehler im Lab (' + (ex && ex.message) + ')'); return 1; }
  }
  function lev(a, b) { const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; } for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; }
  function notFound(sys, name, chunks, R) {
    if (STUBS[name]) { chunks.push({ k: 'e', s: 'bash: ' + name + ': ' + STUBS[name] }); R.hints.push(HINT.SIM); return 1; }
    chunks.push({ k: 'e', s: name + ': command not found' });
    const near = Object.keys(CMDS).filter(n => !(CMDS[n].pkg && !sys.pkgs.inst[CMDS[n].pkg]) && lev(name, n) <= (n.length <= 3 ? 1 : 2)).sort((a, b) => lev(name, a) - lev(name, b))[0];
    R.hints.push(near ? 'Hinweis: Den Befehl gibt es nicht. Meintest du "' + near + '"? Tippfehler sind der häufigste Grund.' : HINT.NOCMD);
    return 127;
  }
  function runFile(sys, name, abs, argv, user, chunks, R) {
    const w = walk(sys, abs, user), E = (m, h) => { chunks.push({ k: 'e', s: 'bash: ' + name + ': ' + m }); if (h) R.hints.push(HINT[h] || h); return 126; };
    if (w.err) { E(ETXT[w.err], w.err); return w.err === 'ENOENT' ? 127 : 126; }
    if (w.n.t === 'd') return E(ETXT.EISDIR, 'Hinweis: Das ist ein Ordner und kein Programm. Mit cd wechselst du hinein.');
    if (!can(sys, w.n, user, 1)) return E(ETXT.EACCES, 'Hinweis: Die Datei hat kein Ausführungsrecht (x). Mit ls -l siehst du die Rechte, mit chmod +x gibst du sie.');
    if (!can(sys, w.n, user, 4) && user !== 'root') return E(ETXT.EACCES, 'EACCES');
    if (w.n.sim != null) { if (w.n.sim) chunks.push({ k: 'o', s: w.n.sim.endsWith('\n') ? w.n.sim : w.n.sim + '\n' }); return 0; }
    R.hints.push('Hinweis: Im Lab laufen Skripte nur, wenn sie eine Simulation hinterlegt haben. Lesen kannst du sie immer mit cat.'); return 0;
  }

  /* Optionen zerlegen: bool = Zeichen ohne Wert, val = Zeichen mit Wert; liefert {f, v, rest} oder null (Fehler ausgegeben) */
  function opts(c, args, bool, val, longs) {
    const f = {}, v = {}, rest = []; let end = false; val = val || '';
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (end || a === '-' || a[0] !== '-' || a.length === 1) { rest.push(a); continue; }
      if (a === '--') { end = true; continue; }
      if (a.startsWith('--')) { const nm = a.slice(2).split('=')[0], l = longs && longs[nm]; if (!l) { c.er(c.name + ": unrecognized option '" + a + "'", 'OPT'); c.er("Try '" + c.name + " --help' for more information."); return null; } if (l.length === 1 && val.includes(l)) { const eq = a.indexOf('='); v[l] = eq > 0 ? a.slice(eq + 1) : args[++i]; } else f[l] = true; continue; }
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        if (val.includes(ch)) { const rem = a.slice(j + 1); if (rem) v[ch] = rem; else { if (i + 1 >= args.length) { c.er(c.name + ": option requires an argument -- '" + ch + "'", 'USAGE'); return null; } v[ch] = args[++i]; } break; }
        if (bool.includes(ch)) f[ch] = true; else { c.er(c.name + ": invalid option -- '" + ch + "'", 'OPT'); c.er("Try '" + c.name + " --help' for more information."); return null; }
      }
    }
    return { f, v, rest };
  }
  function readIn(c, p) {
    if (p === '-') return { text: c.stdin };
    const w = c.get(p); if (w.err) { c.fe(w.err, p); return null; }
    if (w.n.t === 'd') { c.fe('EISDIR', p); return null; }
    if (w.n.dev) return { text: '' };
    if (!c.can(w.n, 4)) { c.fe('EACCES', p); return null; }
    return { text: w.n.content, node: w.n };
  }
  /* alle Eingaben (Dateien oder stdin) lesen; liefert [{name, text}] und Fehlerzahl */
  function readAll(c, files) {
    const out = []; let bad = 0;
    if (!files.length) return { list: [{ name: '-', text: c.stdin }], bad };
    files.forEach(p => { const r = readIn(c, p); if (r) out.push({ name: p, text: r.text }); else bad++; });
    return { list: out, bad };
  }
  function writeTo(c, p, text, append) {
    const f = openOut(c.sys, p, append, c.user); if (f.err) { c.fe(f.err, p); return false; } if (!f.dev) f.node.content += text; return true;
  }

  /* ---------- Befehle ---------- */
  /* PRUEFEN P21: Nicht simuliert (Meldung "wird im Lab nicht simuliert"): tar, ssh, git, vim, nano, journalctl, python3 u. a. (awk, sed und systemctl gibt es seit Version 2 in einfacher Form, siehe P28 und P29). Soll journalctl ... */
  const CMDS = {}, USAGE = {}, STUBS = {};
  const def = (names, usage, fn, extra) => { (Array.isArray(names) ? names : [names]).forEach(n => { CMDS[n] = Object.assign({ fn }, extra || {}); if (usage) USAGE[n] = usage; }); };

  def('pwd', 'pwd', c => { c.ln(c.sys.cwd); });
  def('echo', 'echo [-n] [-e] [TEXT]...', c => {
    let a = c.args.slice(), nl = true, esc = false; while (a.length && /^-[neE]+$/.test(a[0])) { if (a[0].includes('n')) nl = false; if (a[0].includes('e')) esc = true; a.shift(); }
    let s = a.join(' '); if (esc) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); c.o(s + (nl ? '\n' : ''));
  });
  def('cd', 'cd [Ordner]', c => {
    const sys = c.sys; if (c.args.length > 1) { c.er('bash: cd: too many arguments', 'USAGE'); return 1; }
    let t = c.args[0]; if (t === undefined || t === '~') t = sys.users[c.user] ? sys.users[c.user].home : '/'; else if (t === '-') { if (!sys.oldpwd) { c.er('bash: cd: OLDPWD not set'); return 1; } t = sys.oldpwd; c.ln(t); }
    const abs = c.abs(t), w = walk(sys, abs, sys.user);
    if (w.err) { c.er('bash: cd: ' + c.args[0] + ': ' + ETXT[w.err], w.err); return 1; }
    if (w.n.t !== 'd') { c.er('bash: cd: ' + c.args[0] + ': ' + ETXT.ENOTDIR, 'ENOTDIR'); return 1; }
    if (!can(sys, w.n, sys.user, 1)) { c.er('bash: cd: ' + c.args[0] + ': ' + ETXT.EACCES, 'EACCES'); return 1; }
    sys.oldpwd = sys.cwd; sys.cwd = abs; sys.env.PWD = abs;
  }, { bi: true });
  /* PRUEFEN P11: ls gibt im Terminal alles in einer Zeile mit zwei Leerzeichen aus (kein Spaltenumbruch wie beim echten ls), in Pipes zeilenweise. Die "total"-Zahl ... */
  def('ls', 'ls [-a] [-l] [-h] [-R] [-d] [-1] [Ordner|Datei]...', c => {
    const o = opts(c, c.args, 'alhRd1FtrS'); if (!o) return 2; const F = o.f; let paths = o.rest; if (!paths.length) paths = ['.']; let code = 0;
    const entry = (name, n) => ({ name, n });
    const fmtL = list => {
      const rows = list.map(e => { const n = e.n, ls = (n.t === 'd' ? 'd' : '-') + modeSym(n.mode), links = n.t === 'd' ? 2 + Object.keys(n.ch).filter(k => n.ch[k].t === 'd').length : 1; return [ls, String(links), n.owner, n.group, F.h ? human(sizeOf(n)) : String(sizeOf(n)), n.mt, e.name]; });
      const w = [0, 1, 2, 3, 4].map(i => Math.max(...rows.map(r => r[i].length)));
      return rows.map(r => r[0] + ' ' + lpad(r[1], w[1]) + ' ' + pad(r[2], w[2]) + ' ' + pad(r[3], w[3]) + ' ' + lpad(r[4], w[4]) + ' ' + r[5] + ' ' + r[6]).join('\n');
    };
    const sortL = l => { l.sort((a, b) => lsCmp(a.name, b.name)); if (F.r) l.reverse(); return l; };
    const listing = (list) => { if (!list.length) return ''; if (F.l) return fmtL(list) + '\n'; return F['1'] || !c.tty ? list.map(e => e.name).join('\n') + '\n' : list.map(e => e.name).join('  ') + '\n'; };
    const files = [], dirs = [];
    paths.forEach(p => {
      const w = c.get(p);
      if (w.err) { c.er("ls: cannot access '" + p + "': " + ETXT[w.err], w.err); code = 2; return; }
      if (w.n.t === 'd' && !F.d) dirs.push({ p, abs: w.abs, n: w.n }); else files.push(entry(p, w.n));
    });
    let outp = ''; const sections = [];
    if (files.length) outp += listing(sortL(files));
    const doDir = (d, header, rec) => {
      let s = header ? d.p + ':\n' : '';
      if (!c.can(d.n, 4)) { c.er("ls: cannot open directory '" + d.p + "': " + ETXT.EACCES, 'EACCES'); code = 2; return s.trim() ? '' : ''; }
      let names = Object.keys(d.n.ch).filter(k => F.a || k[0] !== '.'); let list = names.map(k => entry(k, d.n.ch[k]));
      if (F.a) { list.push(entry('.', d.n)); const par = walk(c.sys, dirname(d.abs), 'root'); list.push(entry('..', par.n || d.n)); }
      sortL(list);
      if (F.l) { const blocks = list.reduce((a, e) => a + (e.n.t === 'd' ? 4 : (sizeOf(e.n) ? Math.ceil(sizeOf(e.n) / 4096) * 4 : 0)), 0); s += 'total ' + blocks + '\n'; }
      s += listing(list);
      if (rec) names.filter(k => d.n.ch[k].t === 'd').sort(lsCmp).forEach(k => { s += '\n' + doDir({ p: (d.p === '/' ? '' : d.p) + '/' + k, abs: joinP(d.abs, k), n: d.n.ch[k] }, true, true); });
      return s;
    };
    dirs.forEach((d, i) => { if (outp && i === 0) outp += '\n'; if (i > 0) outp += '\n'; outp += doDir(d, dirs.length > 1 || files.length > 0 || F.R, F.R); });
    c.o(outp); return code;
  });
  def('mkdir', 'mkdir [-p] Ordner...', c => {
    const o = opts(c, c.args, 'pv'); if (!o) return 2; if (!o.rest.length) { c.er('mkdir: missing operand', 'USAGE'); return 1; } let code = 0;
    o.rest.forEach(p => {
      const abs = c.abs(p);
      const mk = a => { const par = parentOf(c.sys, a, c.user); if (par.err) return par.err; if (par.dir.ch[par.name]) return 'EEXIST'; if (!c.can(par.dir, 2)) return 'EACCES'; par.dir.ch[par.name] = mkNode('d', 0o777 & ~c.sys.umask, c.user, primGroup(c.sys, c.user)); return null; };
      if (o.f.p) {
        const ps = parts(abs); let cur = '';
        for (const s of ps) { cur += '/' + s; const w = walk(c.sys, cur, c.user); if (w.n) { if (w.n.t !== 'd' && cur === abs) { c.er("mkdir: cannot create directory '" + p + "': File exists", 'EEXIST'); code = 1; } continue; } const r = mk(cur); if (r) { c.er("mkdir: cannot create directory '" + p + "': " + ETXT[r], r); code = 1; break; } else if (o.f.v) c.ln("mkdir: created directory '" + cur + "'"); }
      } else { const r = mk(abs); if (r) { c.er("mkdir: cannot create directory '" + p + "': " + ETXT[r], r); code = 1; } else if (o.f.v) c.ln("mkdir: created directory '" + p + "'"); }
    }); return code;
  });
  def('rmdir', 'rmdir Ordner...', c => {
    if (!c.args.length) { c.er('rmdir: missing operand', 'USAGE'); return 1; } let code = 0;
    c.args.forEach(p => {
      const abs = c.abs(p), w = c.get(p); if (w.err) { c.er("rmdir: failed to remove '" + p + "': " + ETXT[w.err], w.err); code = 1; return; }
      if (w.n.t !== 'd') { c.er("rmdir: failed to remove '" + p + "': " + ETXT.ENOTDIR, 'ENOTDIR'); code = 1; return; }
      if (Object.keys(w.n.ch).length) { c.er("rmdir: failed to remove '" + p + "': " + ETXT.ENOTEMPTY, 'ENOTEMPTY'); code = 1; return; }
      const par = parentOf(c.sys, abs, c.user); if (par.err || abs === c.sys.cwd || !canDelete(c.sys, par.dir, w.n, c.user)) { c.er("rmdir: failed to remove '" + p + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; } delete par.dir.ch[par.name];
    }); return code;
  });
  def('rm', 'rm [-r] [-f] Datei|Ordner...', c => {
    const o = opts(c, c.args, 'rRfiv'); if (!o) return 2; const rec = o.f.r || o.f.R;
    if (!o.rest.length) { if (o.f.f) return 0; c.er('rm: missing operand', 'USAGE'); return 1; } let code = 0;
    o.rest.forEach(p => {
      const abs = c.abs(p);
      if (abs === '/') { c.er("rm: it is dangerous to operate recursively on '/'"); c.er('rm: use --no-preserve-root to override this failsafe'); code = 1; return; }
      if (/(^|\/)\.\.?$/.test(p)) { c.er("rm: refusing to remove '.' or '..' directory: skipping '" + p + "'"); code = 1; return; }
      const w = c.get(p);
      if (w.err) { if (!(o.f.f && w.err === 'ENOENT')) { c.er("rm: cannot remove '" + p + "': " + ETXT[w.err], w.err); code = 1; } return; }
      if (w.n.t === 'd' && !rec) { c.er("rm: cannot remove '" + p + "': " + ETXT.EISDIR, 'EISDIR'); code = 1; return; }
      const par = parentOf(c.sys, abs, c.user); if (par.err) { c.er("rm: cannot remove '" + p + "': " + ETXT[par.err], par.err); code = 1; return; }
      if (!canDelete(c.sys, par.dir, w.n, c.user)) { c.er("rm: cannot remove '" + p + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; }
      if (w.n.t === 'd') { let blocked = null; const chk = (n, a) => { for (const k of Object.keys(n.ch)) { const ch = n.ch[k]; if (!canDelete(c.sys, n, ch, c.user)) { blocked = a + '/' + k; return; } if (ch.t === 'd') { chk(ch, a + '/' + k); if (blocked) return; } } }; chk(w.n, p); if (blocked) { c.er("rm: cannot remove '" + blocked + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; } }
      delete par.dir.ch[par.name]; if (o.f.v) c.ln("removed '" + p + "'");
    }); return code;
  });
  def('touch', 'touch Datei...', c => {
    const o = opts(c, c.args, 'c'); if (!o) return 2; if (!o.rest.length) { c.er('touch: missing file operand', 'USAGE'); return 1; } let code = 0;
    o.rest.forEach(p => {
      const abs = c.abs(p), w = c.get(p);
      if (w.n) { if (!c.can(w.n, 2) && c.user !== 'root') { c.er("touch: cannot touch '" + p + "': " + ETXT.EACCES, 'EACCES'); code = 1; } else w.n.mt = NOW; return; }
      if (w.err !== 'ENOENT') { c.er("touch: cannot touch '" + p + "': " + ETXT[w.err], w.err); code = 1; return; }
      if (o.f.c) return;
      const par = parentOf(c.sys, abs, c.user); if (par.err) { c.er("touch: cannot touch '" + p + "': " + ETXT[par.err], par.err); code = 1; return; }
      if (!c.can(par.dir, 2)) { c.er("touch: cannot touch '" + p + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; }
      par.dir.ch[par.name] = mkNode('f', 0o666 & ~c.sys.umask, c.user, primGroup(c.sys, c.user), '');
    }); return code;
  });
  function cpmv(c, isMv) {
    const nm = isMv ? 'mv' : 'cp'; const o = opts(c, c.args, isMv ? 'fiv' : 'rRafiv'); if (!o) return 2; const rec = o.f.r || o.f.R || o.f.a;
    if (o.rest.length < 2) { c.er(nm + ': missing ' + (o.rest.length ? 'destination file' : 'file') + ' operand', 'USAGE'); return 1; }
    const src = o.rest.slice(0, -1), dst = o.rest[o.rest.length - 1], dw = c.get(dst); let code = 0;
    const dstIsDir = dw.n && dw.n.t === 'd';
    if (src.length > 1 && !dstIsDir) { c.er(nm + ": target '" + dst + "': " + (dw.err ? ETXT[dw.err] : 'Not a directory'), dw.err || 'ENOTDIR'); return 1; }
    src.forEach(p => {
      const sw = c.get(p); if (sw.err) { c.er(nm + ": cannot stat '" + p + "': " + ETXT[sw.err], sw.err); code = 1; return; }
      if (sw.n.t === 'd' && !rec && !isMv) { c.er(nm + ": -r not specified; omitting directory '" + p + "'", 'EISDIR'); code = 1; return; }
      if (!isMv && !c.can(sw.n, 4)) { c.er(nm + ": cannot open '" + p + "' for reading: " + ETXT.EACCES, 'EACCES'); code = 1; return; }
      let tabs, par;
      if (dstIsDir) { tabs = joinP(dw.abs, basename(sw.abs)); } else tabs = c.abs(dst);
      if (sw.abs === tabs) { c.er(nm + ": '" + p + "' and '" + dst + "' are the same file"); code = 1; return; }
      if (sw.n.t === 'd' && (tabs === sw.abs || tabs.startsWith(sw.abs + '/'))) { c.er(nm + ": cannot " + (isMv ? 'move' : 'copy') + " a directory, '" + p + "', into itself, '" + dst + (dstIsDir ? '/' + basename(sw.abs) : '') + "'"); code = 1; return; }
      par = parentOf(c.sys, tabs, c.user); if (par.err) { c.er(nm + ": cannot create " + (sw.n.t === 'd' ? 'directory' : 'regular file') + " '" + dst + "': " + ETXT[par.err], par.err); code = 1; return; }
      if (!c.can(par.dir, 2)) { c.er(nm + ": cannot " + (isMv ? 'move' : 'create regular file') + " '" + p + "' " + (isMv ? 'to ' : '') + "'" + dst + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; }
      const ex = par.dir.ch[par.name];
      if (ex) { if (ex.t === 'd' && sw.n.t !== 'd') { c.er(nm + ": cannot overwrite directory '" + dst + "' with non-directory", 'EISDIR'); code = 1; return; } if (ex.t === 'd' && Object.keys(ex.ch).length) { c.er(nm + ": cannot overwrite non-empty directory '" + dst + "'", 'ENOTEMPTY'); code = 1; return; } if (ex.t === 'f' && !c.can(ex, 2) && c.user !== 'root') { c.er(nm + ": cannot create regular file '" + dst + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; } }
      if (isMv) {
        const sp = parentOf(c.sys, sw.abs, c.user); if (sp.err || !canDelete(c.sys, sp.dir, sw.n, c.user)) { c.er("mv: cannot move '" + p + "' to '" + dst + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; }
        delete sp.dir.ch[sp.name]; par.dir.ch[par.name] = sw.n; sw.n.mt = NOW;
      } else par.dir.ch[par.name] = cloneNode(sw.n, c.user, primGroup(c.sys, c.user), c.sys.umask);
      if (o.f.v) c.ln("'" + p + "' -> '" + (dstIsDir ? dst.replace(/\/$/, '') + '/' + basename(sw.abs) : dst) + "'");
    }); return code;
  }
  def('cp', 'cp [-r] Quelle... Ziel', c => cpmv(c, false));
  def('mv', 'mv Quelle... Ziel', c => cpmv(c, true));

  function catLike(c, view) {
    const o = opts(c, c.args, 'nAbE', '', { number: 'n' }); if (!o) return 2; const r = readAll(c, o.rest); let k = 0, out = '';
    r.list.forEach(x => { if (o.f.n) { const ls = textLines(x.text); out += ls.map(l => lpad(++k, 6) + '\t' + l).join('\n') + (ls.length ? '\n' : ''); } else out += x.text; });
    c.o(out); if (view) c.hint('Hinweis: less und more zeigen eine Datei seitenweise. Im echten Terminal blätterst du mit der Leertaste, suchst mit / und beendest mit q. Das Lab zeigt hier gleich den ganzen Inhalt.'); return r.bad ? 1 : 0;
  }
  def('cat', 'cat [-n] [Datei]...', c => catLike(c, false));
  def(['less', 'more'], 'less Datei', c => catLike(c, true));
  function headTail(c, isHead) {
    let n = 10, plus = false, follow = false; const a = []; const args = c.args;
    for (let i = 0; i < args.length; i++) {
      const x = args[i], m = /^-(\d+)$/.exec(x), m2 = /^-n(\+?\d+)$/.exec(x);
      if (m) n = +m[1]; else if (m2) { plus = m2[1][0] === '+'; n = +m2[1].replace('+', ''); } else if (x === '-n') { const v = args[++i]; if (v === undefined || !/^\+?\d+$/.test(v)) { c.er(c.name + ": invalid number of lines: '" + (v === undefined ? '' : v) + "'", 'USAGE'); return 1; } plus = v[0] === '+'; n = +v.replace('+', ''); } else if (x === '-f' || x === '-F') follow = true; else if (x[0] === '-' && x.length > 1 && x !== '-') { c.er(c.name + ": invalid option -- '" + x.replace(/^-+/, '') + "'", 'OPT'); return 1; } else a.push(x);
    }
    const r = readAll(c, a); const multi = a.length > 1;
    r.list.forEach((x, i) => {
      const ls = textLines(x.text); if (multi) c.o((i ? '\n' : '') + '==> ' + x.name + ' <==\n');
      const sel = isHead ? ls.slice(0, n) : (plus ? ls.slice(Math.max(0, n - 1)) : ls.slice(Math.max(0, ls.length - n)));
      c.o(linesText(sel));
    });
    if (follow) c.hint('Hinweis: tail -f würde hier weiterlaufen und neue Zeilen laufend anzeigen (Strg+C beendet). Das Lab zeigt nur den aktuellen Stand.');
    return r.bad ? 1 : 0;
  }
  def('head', 'head [-n ZAHL] [Datei]...', c => headTail(c, true));
  def('tail', 'tail [-n ZAHL] [-f] [Datei]...', c => headTail(c, false));

  const POSIX = { alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z', space: '\\s', punct: '!-\\/:-@\\[-`{-~' };
  /* PRUEFEN P9: grep: Im Basic-Modus sind + ? | ( ) { } wörtliche Zeichen (nur mit Backslash Sonderzeichen), mit -E gelten sie als Regex-Zeichen, wie bei GNU grep.... */
  function toRegex(pat, f) {
    let src = pat.replace(/\[:(\w+):\]/g, (m, k) => POSIX[k] || m);
    if (f.F) src = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (!f.E) { let s = ''; for (let i = 0; i < src.length; i++) { const ch = src[i]; if (ch === '\\' && i + 1 < src.length) { const nx = src[i + 1]; if ('+?|(){}'.includes(nx)) s += nx; else if (nx === '<' || nx === '>') s += '\\b'; else s += '\\' + nx; i++; } else if ('+?|(){}'.includes(ch)) s += '\\' + ch; else s += ch; } src = s; }
    if (f.x) src = '^(?:' + src + ')$'; else if (f.w) src = '\\b(?:' + src + ')\\b';
    return new RegExp(src, f.i ? 'i' : '');
  }
  def('grep', 'grep [-i] [-n] [-v] [-c] [-r] [-l] [-w] [-o] [-E] [-A n] [-B n] [-C n] Muster [Datei]...', c => {
    const o = opts(c, c.args, 'inFvcrRlwoEhHqsx', 'eABC', {}); if (!o) return 2; const F = o.f; let pat, files = o.rest;
    if (o.v.e !== undefined) pat = o.v.e; else { if (!files.length) { c.er('Usage: grep [OPTION]... PATTERNS [FILE]...'); c.er("Try 'grep --help' for more information.", 'USAGE'); return 2; } pat = files.shift(); }
    let re; try { re = toRegex(pat, F); } catch (ex) { c.er('grep: ' + (/\[/.test(pat) ? 'Unmatched [, [^, [:, [., or [=' : /\(/.test(pat) ? 'Unmatched ( or \\(' : 'Invalid regular expression'), 'Hinweis: Das Suchmuster ist kein gültiger regulärer Ausdruck. Sonderzeichen wie [ ( * . musst du mit \\ schützen oder mit grep -F als reinen Text suchen.'); return 2; }
    const rec = F.r || F.R, ctxA = +(o.v.A || o.v.C || 0), ctxB = +(o.v.B || o.v.C || 0); let list = [], bad = 0;
    if (rec) {
      if (!files.length) files = ['.'];
      files.forEach(p => { const w = c.get(p); if (w.err) { c.fe(w.err, p); bad++; return; } const rcr = (n, pth) => { if (n.t === 'f') { if (!c.can(n, 4)) { c.fe('EACCES', pth); bad++; } else list.push({ name: pth, text: n.content }); } else if (c.can(n, 4) && c.can(n, 1)) Object.keys(n.ch).sort().forEach(k => rcr(n.ch[k], pth.replace(/\/$/, '') + '/' + k)); else { c.fe('EACCES', pth); bad++; } }; rcr(w.n, p); });
    } else if (!files.length) list = [{ name: '(standard input)', text: c.stdin }];
    else files.forEach(p => { const w = c.get(p); if (!w.err && w.n.t === 'd') { c.er('grep: ' + p + ': Is a directory', 'EISDIR'); bad++; return; } const r = readIn(c, p); if (r) list.push({ name: p, text: r.text }); else bad++; });
    const showName = F.H || (!F.h && (rec || files.length > 1)); let any = false, out = '';
    list.forEach(x => {
      const ls = textLines(x.text), hit = ls.map(l => { re.lastIndex = 0; return re.test(l) !== !!F.v; }), cnt = hit.filter(Boolean).length; if (cnt) any = true;
      if (F.q) return;
      if (F.c) { out += (showName ? x.name + ':' : '') + cnt + '\n'; return; }
      if (F.l) { if (cnt) out += x.name + '\n'; return; }
      if (F.o && !F.v) { ls.forEach((l, i) => { if (!hit[i]) return; const g = new RegExp(re.source, re.flags + 'g'); let m; while ((m = g.exec(l)) && m[0] !== '') out += (showName ? x.name + ':' : '') + (F.n ? (i + 1) + ':' : '') + m[0] + '\n'; }); return; }
      const show = new Array(ls.length).fill(false); hit.forEach((h, i) => { if (h) { for (let k = Math.max(0, i - ctxB); k <= Math.min(ls.length - 1, i + ctxA); k++) show[k] = true; } });
      let lastShown = -2;
      ls.forEach((l, i) => { if (!show[i]) return; if ((ctxA || ctxB) && lastShown >= 0 && i > lastShown + 1) out += '--\n'; lastShown = i; out += (showName ? x.name + (hit[i] ? ':' : '-') : '') + (F.n ? (i + 1) + (hit[i] ? ':' : '-') : '') + l + '\n'; });
    });
    c.o(out); return bad ? 2 : any ? 0 : 1;
  });
  def('wc', 'wc [-l] [-w] [-c] [Datei]...', c => {
    const o = opts(c, c.args, 'lwcm'); if (!o) return 2; const F = o.f, all = !F.l && !F.w && !F.c && !F.m; const r = readAll(c, o.rest);
    const rows = r.list.map(x => ({ name: x.name === '-' ? '' : x.name, l: (x.text.match(/\n/g) || []).length, w: (x.text.trim() ? x.text.trim().split(/\s+/).length : 0), c: enc(x.text), m: [...x.text].length }));
    if (rows.length > 1) rows.push({ name: 'total', l: rows.reduce((a, x) => a + x.l, 0), w: rows.reduce((a, x) => a + x.w, 0), c: rows.reduce((a, x) => a + x.c, 0), m: 0 });
    const keys = all ? ['l', 'w', 'c'] : ['l', 'w', 'c', 'm'].filter(k => F[k]);
    const width = keys.length === 1 && rows.length === 1 && !rows[0].name ? 0 : (o.rest.length ? Math.max(...rows.map(x => Math.max(...keys.map(k => String(x[k]).length)))) : 7);
    rows.forEach(x => c.ln(keys.map(k => lpad(x[k], width)).join(' ') + (x.name ? ' ' + x.name : ''))); return r.bad ? 1 : 0;
  });
  def('sort', 'sort [-r] [-n] [-u] [-f] [-t Trenner] [-k Feld] [Datei]...', c => {
    const o = opts(c, c.args, 'rnufb', 'tk'); if (!o) return 2; const r = readAll(c, o.rest); let lines = []; r.list.forEach(x => { lines = lines.concat(textLines(x.text)); });
    const k = o.v.k ? parseInt(o.v.k, 10) : 0, sep = o.v.t;
    const key = l => { if (!k) return l; const fs = sep ? l.split(sep) : l.trim().split(/\s+/); return fs.slice(k - 1).join(sep || ' '); };
    const num = s => { const m = /^\s*[-+]?\d+(\.\d+)?/.exec(s); return m ? parseFloat(m[0]) : 0; };
    const base = (a, b) => { const x = key(a), y = key(b); if (o.f.n) { const d = num(x) - num(y); if (d) return d; } else { const d = o.f.f ? lcmp(x.toUpperCase(), y.toUpperCase()) : lcmp(x, y); if (d) return d; } return 0; };
    let sorted = lines.slice().sort((a, b) => { const d = base(a, b); if (d) return o.f.r ? -d : d; const e = lcmp(a, b); return o.f.u ? 0 : (o.f.r ? -e : e); });
    if (o.f.u) sorted = sorted.filter((l, i) => i === 0 || base(sorted[i - 1], l) !== 0);
    c.o(linesText(sorted)); return r.bad ? 1 : 0;
  });
  def('uniq', 'uniq [-c] [-d] [-u] [-i] [Datei]', c => {
    const o = opts(c, c.args, 'cdui'); if (!o) return 2; const r = readAll(c, o.rest.slice(0, 1)); const ls = r.list.length ? textLines(r.list[0].text) : [], groups = [];
    ls.forEach(l => { const g = groups[groups.length - 1]; if (g && (o.f.i ? g.l.toLowerCase() === l.toLowerCase() : g.l === l)) g.n++; else groups.push({ l, n: 1 }); });
    groups.forEach(g => { if (o.f.d && g.n < 2) return; if (o.f.u && g.n > 1) return; c.ln((o.f.c ? lpad(g.n, 7) + ' ' : '') + g.l); }); return r.bad ? 1 : 0;
  });
  const rangeList = (spec) => { const set = []; for (const p of spec.split(',')) { const m = /^(\d*)-(\d*)$/.exec(p); if (m && (m[1] || m[2])) set.push([m[1] ? +m[1] : 1, m[2] ? +m[2] : Infinity]); else if (/^\d+$/.test(p)) set.push([+p, +p]); else return null; } return set; };
  def('cut', 'cut -d TRENNER -f FELDER [Datei]   oder   cut -c ZEICHEN [Datei]', c => {
    const o = opts(c, c.args, 's', 'dfc'); if (!o) return 2;
    if (o.v.f === undefined && o.v.c === undefined) { c.er('cut: you must specify a list of bytes, characters, or fields', 'USAGE'); return 1; }
    const spec = rangeList(o.v.f !== undefined ? o.v.f : o.v.c); if (!spec) { c.er('cut: invalid field range', 'USAGE'); return 1; }
    const d = o.v.d === undefined ? '\t' : o.v.d; if (d.length !== 1) { c.er('cut: the delimiter must be a single character', 'USAGE'); return 1; }
    const inR = i => spec.some(([a, b]) => i >= a && i <= b); const r = readAll(c, o.rest);
    r.list.forEach(x => textLines(x.text).forEach(l => {
      if (o.v.c !== undefined && o.v.f === undefined) { c.ln([...l].filter((_, i) => inR(i + 1)).join('')); return; }
      if (!l.includes(d)) { if (!o.f.s) c.ln(l); return; }
      c.ln(l.split(d).filter((_, i) => inR(i + 1)).join(d));
    })); return r.bad ? 1 : 0;
  });
  def('tee', 'tee [-a] Datei...', c => {
    const o = opts(c, c.args, 'a'); if (!o) return 2; let code = 0; o.rest.forEach(p => { if (!writeTo(c, p, c.stdin, !!o.f.a)) code = 1; }); c.o(c.stdin); return code;
  });
  def('tr', 'tr MENGE1 MENGE2', c => {
    const o = opts(c, c.args, 'd'); if (!o) return 2; if (o.rest.length < (o.f.d ? 1 : 2)) { c.er('tr: missing operand', 'USAGE'); return 1; }
    const ex = s => s.replace(/(.)-(.)/g, (m, a, b) => { let r = ''; for (let i = a.charCodeAt(0); i <= b.charCodeAt(0); i++) r += String.fromCharCode(i); return r; });
    const A = ex(o.rest[0]), B = o.f.d ? '' : ex(o.rest[1]); let out = ''; for (const ch of c.stdin) { const i = A.indexOf(ch); if (i < 0) out += ch; else if (!o.f.d) out += B[Math.min(i, B.length - 1)]; } c.o(out);
  });
  def('find', 'find [Ordner] [-name Muster] [-type f|d] [-maxdepth N]', c => {
    const a = c.args.slice(), start = []; while (a.length && a[0][0] !== '-') start.push(a.shift()); if (!start.length) start.push('.');
    let name = null, iname = false, type = null, maxd = Infinity;
    while (a.length) { const k = a.shift(); if (k === '-name' || k === '-iname') { name = a.shift(); iname = k === '-iname'; if (name === undefined) { c.er('find: missing argument to `' + k + "'", 'USAGE'); return 1; } } else if (k === '-type') type = a.shift(); else if (k === '-maxdepth') maxd = +a.shift(); else { c.er("find: unknown predicate `" + k + "'", 'OPT'); return 1; } }
    const re = name ? new RegExp(globRe(name).source, iname ? 'i' : '') : null; let code = 0, out = '';
    start.forEach(p => {
      const w = c.get(p); if (w.err) { c.er("find: '" + p + "': " + ETXT[w.err], w.err); code = 1; return; }
      const rec = (n, shown, depth) => {
        const bn = shown === '.' ? '.' : shown.split('/').pop(), okT = !type || (type === 'd' ? n.t === 'd' : n.t === 'f');
        if (okT && (!re || re.test(bn))) out += shown + '\n';
        if (n.t === 'd' && depth < maxd) { if (!c.can(n, 4) || !c.can(n, 1)) { c.er("find: '" + shown + "': " + ETXT.EACCES, 'EACCES'); code = 1; return; } Object.keys(n.ch).sort().forEach(k => rec(n.ch[k], (shown === '/' ? '' : shown) + '/' + k, depth + 1)); }
      };
      rec(w.n, p, 0);
    }); c.o(out); return code;
  });
  def('basename', 'basename Pfad', c => { if (!c.args.length) { c.er('missing operand', 'USAGE'); return 1; } c.ln(basename(c.args[0].replace(/\/+$/, '') || '/')); });
  def('dirname', 'dirname Pfad', c => { if (!c.args.length) { c.er('missing operand', 'USAGE'); return 1; } const a = c.args[0]; c.ln(a.includes('/') ? (dirname(a.startsWith('/') ? a : '/' + a).replace(/^\//, a.startsWith('/') ? '/' : '') || (a.startsWith('/') ? '/' : '.')) : '.'); });

  /* Rechte und Besitz */
  def('chmod', 'chmod [-R] Modus Datei...   (Modus: 754 oder u+x,g-w,o=r)', c => {
    const SEP = String.fromCharCode(3); const o = opts(c, c.args.map(a => (/^-[rwxXstugoa]+$/.test(a) ? SEP : '') + a), 'Rcvf'); if (!o) return 2; o.rest = o.rest.map(a => (a[0] === SEP ? a.slice(1) : a));
    if (o.rest.length < 2) { c.e(o.rest.length ? "missing operand after '" + o.rest[0] + "'" : 'missing operand', 'USAGE'); c.er("Try 'chmod --help' for more information."); return 1; }
    const spec = o.rest[0]; if (applyChmod(spec, 0o644, false, 0o022) === null || /^[0-7]+$/.test(spec) && spec.length > 4) { c.er("chmod: invalid mode: '" + spec + "'", 'Hinweis: Der Modus ist ungültig. Erlaubt sind Oktalzahlen aus den Ziffern 0 bis 7 (z. B. 754) oder symbolische Angaben wie u+x, g-w, o=r, a+rw.'); c.er("Try 'chmod --help' for more information."); return 1; }
    let code = 0;
    o.rest.slice(1).forEach(p => {
      const w = c.get(p); if (w.err) { c.er("chmod: cannot access '" + p + "': " + ETXT[w.err], w.err); code = 1; return; }
      const one = (n, shown) => {
        if (c.user !== 'root' && n.owner !== c.user) { c.er("chmod: changing permissions of '" + shown + "': " + ETXT.EPERM, 'EPERM'); code = 1; return; }
        n.mode = applyChmod(spec, n.mode, n.t === 'd', c.sys.umask);
        if (o.f.c || o.f.v) c.ln("mode of '" + shown + "' changed to " + modeOct(n.mode) + ' (' + modeSym(n.mode) + ')');
      };
      const rec = (n, shown) => { one(n, shown); if (o.f.R && n.t === 'd') Object.keys(n.ch).sort().forEach(k => rec(n.ch[k], shown.replace(/\/$/, '') + '/' + k)); };
      rec(w.n, p);
    }); return code;
  });
  def(['chown', 'chgrp'], 'chown [-R] Benutzer[:Gruppe] Datei...   |   chgrp [-R] Gruppe Datei...', c => {
    const o = opts(c, c.args, 'Rv'); if (!o) return 2; const isG = c.name === 'chgrp';
    if (o.rest.length < 2) { c.e(o.rest.length ? "missing operand after '" + o.rest[0] + "'" : 'missing operand', 'USAGE'); return 1; }
    let ow = null, gr = null; const spec = o.rest[0];
    if (isG) gr = spec; else { const m = /^([^:.]*)(?:[:.](.*))?$/.exec(spec); ow = m[1] || null; gr = m[2] || null; }
    if (ow && !c.sys.users[ow]) { c.e("invalid user: '" + spec + "'", 'Hinweis: Diesen Benutzer gibt es nicht. Alle Benutzer stehen in /etc/passwd (cat /etc/passwd).'); return 1; }
    if (gr && c.sys.groups[gr] == null) { c.e("invalid group: '" + spec + "'", 'Hinweis: Diese Gruppe gibt es nicht. Alle Gruppen stehen in /etc/group (cat /etc/group).'); return 1; }
    let code = 0;
    o.rest.slice(1).forEach(p => {
      const w = c.get(p); if (w.err) { c.e("cannot access '" + p + "': " + ETXT[w.err], w.err); code = 1; return; }
      const one = (n, shown) => {
        const okOwner = c.user === 'root', okGroup = c.user === 'root' || (n.owner === c.user && (!gr || inGroup(c.sys, c.user, gr)));
        if ((ow && ow !== n.owner && !okOwner) || (gr && !okGroup) || (!okOwner && n.owner !== c.user)) { c.e("changing ownership of '" + shown + "': " + ETXT.EPERM, 'EPERM'); code = 1; return; }
        if (ow) n.owner = ow; if (gr) n.group = gr; if (o.f.v) c.ln("ownership of '" + shown + "' retained as " + n.owner + ':' + n.group);
      };
      const rec = (n, shown) => { one(n, shown); if (o.f.R && n.t === 'd') Object.keys(n.ch).sort().forEach(k => rec(n.ch[k], shown.replace(/\/$/, '') + '/' + k)); };
      rec(w.n, p);
    }); return code;
  });
  /* PRUEFEN P4: umask wird nur kurz behandelt (anzeigen, setzen, Rechner im Reiter Rechte). Reicht "nur nennen"? Sonderrechte (setuid, setgid, Sticky-Bit) werden a... */
  def('umask', 'umask [Maske]', c => {
    if (!c.args.length) { c.ln('0' + c.sys.umask.toString(8).padStart(3, '0')); return 0; }
    if (c.args[0] === '-S') { const u = c.sys.umask; const ps = b => (b & 4 ? 'r' : '') + (b & 2 ? 'w' : '') + (b & 1 ? 'x' : ''); c.ln('u=' + ps(7 & ~(u >> 6)) + ',g=' + ps(7 & ~(u >> 3)) + ',o=' + ps(7 & ~u)); return 0; }
    if (!/^[0-7]{1,4}$/.test(c.args[0])) { c.er('bash: umask: ' + c.args[0] + ': octal number out of range', 'USAGE'); return 1; } c.sys.umask = parseInt(c.args[0], 8) & 0o777;
  }, { bi: true });

  /* Benutzer */
  def('whoami', 'whoami', c => { c.ln(c.user); });
  def('id', 'id [Benutzer]', c => {
    const n = c.args[0] || c.user, u = c.sys.users[n]; if (!u) { c.er("id: '" + n + "': no such user"); return 1; }
    const gid = g => c.sys.groups[g]; c.ln('uid=' + u.uid + '(' + n + ') gid=' + gid(u.groups[0]) + '(' + u.groups[0] + ') groups=' + u.groups.map(g => gid(g) + '(' + g + ')').join(','));
  });
  def('groups', 'groups [Benutzer]', c => { const n = c.args[0] || c.user, u = c.sys.users[n]; if (!u) { c.er("groups: '" + n + "': no such user"); return 1; } c.ln(u.groups.join(' ')); });
  def('hostname', 'hostname [-I]', c => { if (c.args[0] === '-I') c.ln(c.sys.net.ip + ' '); else c.ln(c.sys.host); });
  def('uname', 'uname [-a] [-r]', c => { const a = c.args.join(' '); if (/-a/.test(a)) c.ln('Linux ' + c.sys.host + ' 5.15.0-91-generic #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux'); else if (/-r/.test(a)) c.ln('5.15.0-91-generic'); else c.ln('Linux'); });
  def('date', 'date [+FORMAT]', c => {
    const f = c.args.find(a => a[0] === '+'); const d = { Y: '2026', m: '11', d: '08', H: '09', M: '30', S: '00', y: '26', A: 'Sunday', a: 'Sun', B: 'November', b: 'Nov', e: ' 8', Z: 'CET' };
    if (!f) { c.ln('Sun Nov  8 09:30:00 CET 2026'); return 0; }
    c.ln(f.slice(1).replace(/%([a-zA-Z%])/g, (m, k) => k === 'F' ? '2026-11-08' : k === 'T' ? '09:30:00' : k === '%' ? '%' : d[k] != null ? d[k] : m));
  });
  def('sleep', 'sleep Sekunden', c => { if (!c.args.length) { c.er('sleep: missing operand', 'USAGE'); return 1; } if (!/^\d+(\.\d+)?[smhd]?$/.test(c.args[0])) { c.er("sleep: invalid time interval '" + c.args[0] + "'", 'USAGE'); return 1; } });
  def('clear', 'clear', c => { c.R.clear = true; });
  def('true', 'true', () => 0); def('false', 'false', () => 1);
  def(['exit', 'logout'], 'exit', c => { c.hint('Hinweis: Im Lab gibt es kein Beenden. Die Übung läuft im Browser weiter.'); }, { bi: true });
  def('history', 'history', c => { const h = c.sys.hist; h.forEach((l, i) => c.ln(lpad(i + 1, 5) + '  ' + l)); }, { bi: true });
  def(['env', 'printenv'], 'env', c => { Object.keys(c.sys.env).sort().forEach(k => c.ln(k + '=' + c.sys.env[k])); });
  def('export', 'export VAR=wert', c => {
    if (!c.args.length) { Object.keys(c.sys.env).sort().forEach(k => c.ln('declare -x ' + k + '="' + c.sys.env[k] + '"')); return 0; }
    c.args.forEach(a => { const eq = a.indexOf('='); if (eq > 0) c.sys.env[a.slice(0, eq)] = a.slice(eq + 1); });
  }, { bi: true });
  def('unset', 'unset VAR', c => { c.args.forEach(a => { delete c.sys.env[a]; }); }, { bi: true });
  def(['which', 'type'], 'which Befehl', c => {
    let code = 0; c.args.forEach(a => { const d = CMDS[a]; if (d && !d.bi && !(d.pkg && !c.sys.pkgs.inst[d.pkg])) c.ln('/usr/bin/' + a); else if (d && d.bi) c.ln(c.name === 'type' ? a + ' is a shell builtin' : '/usr/bin/' + a); else code = 1; }); return code;
  });
  def('man', 'man Befehl', c => { if (!c.args.length) { c.er('What manual page do you want?'); return 1; } c.er('man: Das Lab hat keine Handbuchseiten.'); c.hint('Hinweis: Die Kurzhilfe bekommst du mit ' + (c.args[0]) + ' --help, die Übersicht mit help. Im echten Terminal zeigt man ' + c.args[0] + ' das ganze Handbuch (q beendet).'); return 1; });
  def('help', 'help', c => {
    c.ln('Befehle in diesem Lab (rein simuliert):');
    const names = Object.keys(CMDS).filter(n => !CMDS[n].pkg).sort(); c.ln(names.join('  ')); c.ln('Mit  BEFEHL --help  siehst du den Aufbau. Sonderzeichen: |  >  >>  <  2>  &&  ||  ;  &  $VAR  $(...)  *  ?  ~');
  });
  def(['test', '['], 'test AUSDRUCK   bzw.   [ AUSDRUCK ]', c => {
    let a = c.args.slice(); if (c.name === '[') { if (a[a.length - 1] !== ']') { c.er('bash: [: missing `]\'', 'USAGE'); return 2; } a.pop(); }
    const fileT = (p, f) => { const w = c.get(p); return !!w.n && f(w.n); };
    let neg = false; if (a[0] === '!') { neg = true; a.shift(); }
    let r;
    if (a.length === 1) r = a[0] !== ''; else if (a.length === 2) { const [op, v] = a; r = op === '-z' ? v === '' : op === '-n' ? v !== '' : op === '-e' ? fileT(v, () => true) : op === '-f' ? fileT(v, n => n.t === 'f') : op === '-d' ? fileT(v, n => n.t === 'd') : op === '-r' ? fileT(v, n => c.can(n, 4)) : op === '-w' ? fileT(v, n => c.can(n, 2)) : op === '-x' ? fileT(v, n => c.can(n, 1)) : null; if (r === null) { c.er('bash: [: ' + op + ': unary operator expected', 'USAGE'); return 2; } }
    else if (a.length === 3) { const [x, op, y] = a; const nx = +x, ny = +y; if (['-eq', '-ne', '-gt', '-lt', '-ge', '-le'].includes(op) && (!/^-?\d+$/.test(x) || !/^-?\d+$/.test(y))) { c.er('bash: [: ' + (/^-?\d+$/.test(x) ? y : x) + ': integer expression expected', 'USAGE'); return 2; } r = op === '=' || op === '==' ? x === y : op === '!=' ? x !== y : op === '-eq' ? nx === ny : op === '-ne' ? nx !== ny : op === '-gt' ? nx > ny : op === '-lt' ? nx < ny : op === '-ge' ? nx >= ny : op === '-le' ? nx <= ny : null; if (r === null) { c.er('bash: [: ' + op + ': binary operator expected', 'USAGE'); return 2; } }
    else if (a.length === 0) r = false; else { c.er('bash: [: too many arguments', 'USAGE'); return 2; }
    return (neg ? !r : r) ? 0 : 1;
  }, { bi: true });

  /* Prozesse */
  const exeOf = p => p.cmd.split(' ')[0].split('/').pop().replace(/:$/, '');
  def('ps', 'ps [aux | -ef | -e]', c => {
    const sys = c.sys, args = c.args, A = args.join(' ');
    const me = { pid: sys.nextPid++, ppid: 1201, user: c.user, cpu: 0, mem: 0.1, vsz: 12000, rss: 3500, tty: 'pts/0', stat: 'R+', start: '09:30', time: '0:00', cmd: ('ps ' + A).trim() };
    const uOpt = /-us*(w+)/.exec(A); let list = sys.procs.concat([me]); if (uOpt) list = list.filter(p => p.user === uOpt[1]);
    const ef = args.some(x => /^-?(ef|f)$/.test(x)), aux = args.some(x => /^-?(aux|ax|au|a|u|x|ux)$/.test(x)), all = args.some(x => /^-(e|A)$/.test(x));
    const hh = t => (t.length < 5 ? '00:0' + t : '00:' + t);
    if (ef) { c.ln('UID          PID    PPID  C STIME TTY          TIME CMD'); list.forEach(p => c.ln(pad(p.user.slice(0, 8), 8) + ' ' + lpad(p.pid, 7) + ' ' + lpad(p.ppid, 7) + '  ' + (p.cpu > 0.5 ? 1 : 0) + ' ' + pad(p.start, 5) + ' ' + pad(p.tty, 8) + ' ' + lpad(hh(p.time), 8) + ' ' + p.cmd)); return 0; }
    if (aux || uOpt) { c.ln('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND'); list.forEach(p => c.ln(pad(p.user.slice(0, 8), 8) + ' ' + lpad(p.pid, 7) + ' ' + lpad(p.cpu.toFixed(1), 4) + ' ' + lpad(p.mem.toFixed(1), 4) + ' ' + lpad(p.vsz, 6) + ' ' + lpad(p.rss, 5) + ' ' + pad(p.tty, 8) + ' ' + pad(p.stat, 4) + ' ' + pad(p.start, 5) + ' ' + lpad(p.time, 6) + ' ' + p.cmd)); return 0; }
    c.ln('    PID TTY          TIME CMD'); list.filter(p => all || (p.tty === 'pts/0' && p.user === c.user)).forEach(p => c.ln(lpad(p.pid, 7) + ' ' + pad(p.tty, 8) + ' ' + hh(p.time).padStart(8, '0') + ' ' + exeOf(p)));
  });
  def('top', 'top -b -n 1   (im Lab nur eine Momentaufnahme)', c => {
    const P = c.sys.procs, us = Math.min(100, rd(P.reduce((a, p) => a + p.cpu, 0), 1)), sorted = P.slice().sort((a, b) => b.cpu - a.cpu || a.pid - b.pid), run = us > 50 ? 2 : 1;
    c.ln('top - 09:30:15 up 3 days,  4:12,  1 user,  load average: ' + (us / 100 + 0.1).toFixed(2) + ', 0.31, 0.20');
    c.ln('Tasks: ' + lpad(P.length, 3) + ' total,   ' + run + ' running, ' + lpad(P.length - run, 3) + ' sleeping,   0 stopped,   0 zombie');
    c.ln('%Cpu(s): ' + lpad(us.toFixed(1), 5) + ' us,  1.0 sy,  0.0 ni, ' + lpad(Math.max(0, 99 - us).toFixed(1), 5) + ' id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st');
    c.ln('MiB Mem :   3936.0 total,   1520.4 free,    980.3 used,   1435.3 buff/cache'); c.ln('MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   2700.0 avail Mem'); c.ln('');
    c.ln('    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND');
    sorted.slice(0, 10).forEach(p => c.ln(lpad(p.pid, 7) + ' ' + pad(p.user.slice(0, 8), 9) + ' 20   0 ' + lpad(p.vsz, 7) + ' ' + lpad(p.rss, 6) + ' ' + lpad(Math.round(p.rss / 3), 6) + ' ' + p.stat[0] + ' ' + lpad(p.cpu.toFixed(1), 5) + ' ' + lpad(p.mem.toFixed(1), 5) + ' ' + lpad('0:' + p.time.split(':').pop().padStart(2, '0') + '.00', 9) + ' ' + exeOf(p)));
    c.hint('Hinweis: Das echte top läuft live und aktualisiert sich alle paar Sekunden (q beendet). Das Lab zeigt eine Momentaufnahme, nach CPU sortiert.');
  });
  const SIGS = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, TERM: 15, STOP: 19, CONT: 18, USR1: 10 };
  /* PRUEFEN P8: Signale vereinfacht: kill (15) beendet normale Prozesse, "hängende" Prozesse ignorieren es und enden erst mit kill -9; HUP, STOP und USR1 haben kei... */
  def('kill', 'kill [-9] PID...   |   kill %JOB', c => {
    let a = c.args.slice(), sig = 15; if (!a.length) { c.er('bash: kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]'); return 2; }
    if (a[0] === '-l') { c.ln(Object.keys(SIGS).map(k => SIGS[k] + ') SIG' + k).join('  ')); return 0; }
    if (/^-[A-Za-z0-9]+$/.test(a[0])) { const s = a.shift().slice(1).replace(/^SIG/, ''); sig = /^\d+$/.test(s) ? +s : SIGS[s]; if (sig == null) { c.er('bash: kill: ' + s + ': invalid signal specification', 'USAGE'); return 1; } }
    if (!a.length) { c.er('bash: kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]'); return 2; }
    let code = 0;
    a.forEach(t => {
      let pid; const jm = /^%(\d+)$/.exec(t);
      if (jm) { const j = c.sys.jobs.find(x => x.n === +jm[1]); if (!j) { c.er('bash: kill: %' + jm[1] + ': no such job', 'Hinweis: Diese Jobnummer gibt es nicht. jobs zeigt die laufenden Hintergrundjobs.'); code = 1; return; } pid = j.pid; } else if (/^\d+$/.test(t)) pid = +t; else { c.er('bash: kill: ' + t + ': arguments must be process or job IDs', 'USAGE'); code = 1; return; }
      const p = c.sys.procs.find(x => x.pid === pid); if (!p) { c.er('bash: kill: (' + pid + ') - No such process', 'Hinweis: Diese Prozessnummer gibt es nicht (mehr). ps aux zeigt die laufenden Prozesse.'); code = 1; return; }
      if (c.user !== 'root' && p.user !== c.user) { c.er('bash: kill: (' + pid + ') - Operation not permitted', 'EPERM'); code = 1; return; }
      if (![2, 3, 9, 15].includes(sig)) return;
      if (p.stubborn && sig !== 9) { c.hint('Hinweis: Das Signal wurde gesendet, aber der Prozess läuft noch (prüfe mit ps aux). Manche Prozesse ignorieren das normale Beenden (SIGTERM, Nummer 15). kill -9 (SIGKILL) erzwingt das Ende.'); return; }
      c.sys.procs = c.sys.procs.filter(x => x.pid !== pid); const j = c.sys.jobs.find(x => x.pid === pid); if (j) { c.sys.jobs = c.sys.jobs.filter(x => x !== j); c.sys.notices.push('[' + j.n + ']+  Terminated              ' + j.cmd); }
    }); return code;
  });
  def('jobs', 'jobs', c => { const J = c.sys.jobs; J.forEach((j, i) => c.ln('[' + j.n + ']' + (i === J.length - 1 ? '+' : i === J.length - 2 ? '-' : ' ') + '  Running                 ' + j.cmd + ' &')); }, { bi: true });
  def('pgrep', 'pgrep Name', c => { if (!c.args.length) { c.er('pgrep: no matching criteria specified', 'USAGE'); return 2; } const r = c.sys.procs.filter(p => exeOf(p).includes(c.args[c.args.length - 1])); r.forEach(p => c.ln(String(p.pid))); return r.length ? 0 : 1; });

  /* sudo, Konten */
  /* PRUEFEN P5: sudo gilt für Mitglieder der Gruppe sudo (Ubuntu-Weg). Das Passwort wird im Lab als schon eingegeben angenommen (nur ein Hinweis). Soll die Passwor... */
  def('sudo', 'sudo [-u Benutzer] Befehl   |   sudo -l', c => {
    const sys = c.sys, a = c.args.slice(); let as = 'root';
    if (a[0] === '-l') { if (!sudoer(sys, c.user)) { c.er('Sorry, user ' + c.user + ' may not run sudo on ' + sys.host + '.'); return 1; } c.ln('User ' + c.user + ' may run the following commands on ' + sys.host + ':'); c.ln('    (ALL : ALL) ALL'); return 0; }
    if (a[0] === '-u') { a.shift(); as = a.shift(); if (!sys.users[as]) { c.er("sudo: unknown user " + as, 'Hinweis: Diesen Benutzer gibt es nicht (siehe /etc/passwd).'); return 1; } }
    if (!a.length) { c.er('usage: sudo -h | -K | -k | -V'); c.er('usage: sudo [-u user] command', 'USAGE'); return 1; }
    if (!sudoer(sys, c.user)) { c.er(c.user + ' is not in the sudoers file.  This incident will be reported.', 'NOSUDO'); return 1; }
    if (!sys.sudoSeen) { sys.sudoSeen = true; c.hint('Hinweis: Das echte sudo fragt hier nach deinem Passwort ([sudo] password for ' + c.user + '). Im Lab ist es schon eingegeben.'); }
    if (CMDS[a[0]] && CMDS[a[0]].bi) { c.er('sudo: ' + a[0] + ': command not found', 'Hinweis: cd, export, umask und andere Shell-Befehle sind keine Programme. sudo kann sie nicht starten.'); return 1; }
    const chunks = []; const code = execCmd(sys, a, c.stdin, as, c.tty, chunks, c.R);
    chunks.forEach(ch => { if (ch.k === 'o') c.o(ch.s); else { if (/command not found$/.test(ch.s)) c.er('sudo: ' + ch.s); else c.er(ch.s); } }); return code;
  }, { bi: true });
  const sudoer = (sys, u) => u === 'root' || inGroup(sys, u, 'sudo');
  const needRoot = (c, what) => { if (c.user !== 'root') { c.er(what + ': Permission denied.', 'EPERM'); return true; } return false; };
  def(['useradd', 'adduser'], 'useradd -m [-G Gruppe] Name   |   adduser Name [Gruppe]', c => {
    const o = opts(c, c.args, 'm', 'GsdcgN'); if (!o) return 2; const sys = c.sys;
    if (c.name === 'adduser' && o.rest.length === 2 && !o.f.m) { /* adduser BENUTZER GRUPPE */
      if (needRoot(c, 'adduser')) return 1; const [u, g] = o.rest; if (!sys.users[u]) { c.er("adduser: The user `" + u + "' does not exist."); return 1; } if (sys.groups[g] == null) { c.er("adduser: The group `" + g + "' does not exist."); return 1; }
      if (!sys.users[u].groups.includes(g)) sys.users[u].groups.push(g); syncAccounts(sys); c.ln("Adding user `" + u + "' to group `" + g + "' ..."); c.ln('Done.'); return 0;
    }
    if (o.rest.length !== 1) { c.er(c.name + ': Usage: ' + (c.name === 'useradd' ? 'useradd [options] LOGIN' : 'adduser [--home DIR] [--shell SHELL] USER'), 'USAGE'); return 2; }
    if (needRoot(c, c.name)) return 1; const nm = o.rest[0];
    if (!/^[a-z_][a-z0-9_-]{0,30}$/.test(nm)) { c.er(c.name + ": invalid user name '" + nm + "'", 'Hinweis: Benutzernamen bestehen aus Kleinbuchstaben, Ziffern, _ und -, und beginnen mit einem Buchstaben.'); return 3; }
    if (sys.users[nm]) { c.er(c.name === 'useradd' ? "useradd: user '" + nm + "' already exists" : "adduser: The user `" + nm + "' already exists.", 'EEXIST'); return 9; }
    const uid = Math.max(999, ...Object.keys(sys.users).map(n => sys.users[n].uid).filter(x => x < 60000)) + 1; sys.groups[nm] = sys.groups[nm] != null ? sys.groups[nm] : uid;
    const gs = [nm]; if (o.v.G) o.v.G.split(',').forEach(g => { if (sys.groups[g] != null) gs.push(g); });
    sys.users[nm] = { uid, home: '/home/' + nm, groups: gs, gecos: '', shell: '/bin/bash' };
    if (o.f.m || c.name === 'adduser') { put(sys, { p: '/home/' + nm, t: 'd', m: 0o755, o: nm, g: nm }); }
    syncAccounts(sys); if (c.name === 'adduser') { c.ln("Adding user `" + nm + "' ..."); c.ln('Adding new group `' + nm + "' (" + uid + ') ...'); c.ln("Creating home directory `/home/" + nm + "' ..."); c.ln('(Im echten Terminal fragt adduser jetzt nach einem Passwort.)'); }
  });
  def('groupadd', 'groupadd Gruppe', c => {
    if (c.args.length !== 1) { c.er('groupadd: Usage: groupadd [options] GROUP', 'USAGE'); return 2; } if (needRoot(c, 'groupadd')) return 1;
    if (c.sys.groups[c.args[0]] != null) { c.er("groupadd: group '" + c.args[0] + "' already exists", 'EEXIST'); return 9; } c.sys.groups[c.args[0]] = Math.max(999, ...Object.values(c.sys.groups).filter(x => x < 60000)) + 1; syncAccounts(c.sys);
  });
  def('usermod', 'usermod -aG Gruppe Benutzer', c => {
    const o = opts(c, c.args, 'a', 'Gs'); if (!o) return 2; if (o.rest.length !== 1 || !o.v.G) { c.er('Usage: usermod [options] LOGIN', 'USAGE'); return 2; }
    if (needRoot(c, 'usermod')) return 1; const u = c.sys.users[o.rest[0]]; if (!u) { c.er("user '" + o.rest[0] + "' does not exist"); return 6; }
    const gs = o.v.G.split(','); for (const g of gs) if (c.sys.groups[g] == null) { c.er("group '" + g + "' does not exist"); return 6; }
    if (!o.f.a) { u.groups = [u.groups[0]].concat(gs.filter(g => g !== u.groups[0])); c.hint('Hinweis: Ohne -a ersetzt usermod -G alle bisherigen Zusatzgruppen. Meist willst du -aG (anhängen).'); } else gs.forEach(g => { if (!u.groups.includes(g)) u.groups.push(g); });
    syncAccounts(c.sys);
  });
  def('passwd', 'passwd [Benutzer]', c => { c.er('passwd: Die Passworteingabe wird im Lab nicht simuliert.', 'SIM'); return 1; });
  STUBS.su = 'Wechsel des Benutzers wird im Lab nicht simuliert. Nutze sudo.';

  /* Pakete */
  const pkgLine = (n, v, d) => n + '/jammy,now ' + v + ' amd64 [installed]' + (d ? '' : '');
  /* PRUEFEN P6: apt-Ausgaben sind stark gekürzt im Stil von Ubuntu 22.04 (Paketversionen frei gewählt, Rückfrage "Do you want to continue?" wird automatisch bejaht... */
  function aptRun(c, name) {
    const sys = c.sys, a = c.args.filter(x => x !== '-y' && x !== '--yes' && x !== '-q'), assume = c.args.includes('-y') || c.args.includes('--yes'), sub = a[0], pk = sys.pkgs;
    if (!sub) { c.ln('apt 2.4.11 (amd64)'); c.ln('Usage: apt [options] command'); c.ln('Commands: update, upgrade, install, remove, purge, autoremove, search, show, list'); return 0; }
    const needR = ['update', 'upgrade', 'install', 'remove', 'purge', 'autoremove', 'full-upgrade', 'dist-upgrade'].includes(sub);
    if (needR && c.user !== 'root') { c.er('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)'); c.er('E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 'LOCK'); return 100; }
    if (sub === 'update') { c.ln('Hit:1 http://de.archive.ubuntu.com/ubuntu jammy InRelease'); c.ln('Get:2 http://de.archive.ubuntu.com/ubuntu jammy-updates InRelease [119 kB]'); c.ln('Fetched 119 kB in 1s (210 kB/s)'); c.ln('Reading package lists... Done'); c.ln('Building dependency tree... Done'); c.ln('All packages are up to date.'); pk.updated = true; return 0; }
    if (sub === 'upgrade' || sub === 'full-upgrade' || sub === 'dist-upgrade') { c.ln('Reading package lists... Done'); c.ln('Building dependency tree... Done'); c.ln('Calculating upgrade... Done'); c.ln('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0; }
    if (sub === 'install' || sub === 'reinstall') {
      const names = a.slice(1); if (!names.length) { c.er('E: Command line option... no package given', 'USAGE'); return 100; }
      for (const n of names) if (!pk.avail[n] && !pk.inst[n]) { c.er('E: Unable to locate package ' + n, 'NOPKG'); return 100; }
      const nw = names.filter(n => !pk.inst[n]);
      c.ln('Reading package lists... Done'); c.ln('Building dependency tree... Done');
      names.filter(n => pk.inst[n]).forEach(n => c.ln(n + ' is already the newest version (' + pk.inst[n] + ').'));
      if (nw.length) { c.ln('The following NEW packages will be installed:'); c.ln('  ' + nw.join(' ')); c.ln('0 upgraded, ' + nw.length + ' newly installed, 0 to remove and 0 not upgraded.'); c.ln('Need to get 112 kB of archives.'); c.ln('Do you want to continue? [Y/n] ' + (assume ? '' : 'Y'));
        nw.forEach(n => { c.ln('Get:1 http://de.archive.ubuntu.com/ubuntu jammy/universe amd64 ' + n + ' amd64 ' + pk.avail[n].v + ' [112 kB]'); }); nw.forEach(n => { pk.inst[n] = pk.avail[n].v; c.ln('Setting up ' + n + ' (' + pk.avail[n].v + ') ...'); });
        if (!assume) c.hint('Hinweis: Das echte apt fragt "Do you want to continue? [Y/n]" und wartet. Mit -y (apt install -y paket) bestätigst du automatisch.');
      } else c.ln('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0;
    }
    if (sub === 'remove' || sub === 'purge') {
      const names = a.slice(1); if (!names.length) { c.er('E: no package given', 'USAGE'); return 100; } let any = false;
      names.forEach(n => { if (!pk.avail[n] && !pk.inst[n]) { c.er('E: Unable to locate package ' + n, 'NOPKG'); return; } if (!pk.inst[n]) { c.ln('Package \'' + n + '\' is not installed, so not removed'); return; } if (pk.avail[n] && pk.avail[n].base) { c.er('E: Das Paket ' + n + ' gehört zum Grundsystem und wird im Lab nicht entfernt.'); return; } delete pk.inst[n]; any = true; c.ln('Removing ' + n + ' (' + pk.avail[n].v + ') ...'); });
      if (any) c.ln('0 upgraded, 0 newly installed, ' + names.length + ' to remove and 0 not upgraded.'); return 0;
    }
    if (sub === 'autoremove') { c.ln('Reading package lists... Done'); c.ln('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'); return 0; }
    if (sub === 'list') { const inst = a.includes('--installed'); Object.keys(pk.avail).sort().filter(n => !inst || pk.inst[n]).forEach(n => c.ln(n + '/jammy ' + pk.avail[n].v + ' amd64' + (pk.inst[n] ? ' [installed]' : ''))); if (!inst) c.hint('Hinweis: apt list --installed zeigt nur die installierten Pakete.'); return 0; }
    if (sub === 'search') { if (!a[1]) { c.er('E: You must give at least one search pattern', 'USAGE'); return 100; } Object.keys(pk.avail).sort().filter(n => n.includes(a[1]) || pk.avail[n].d.toLowerCase().includes(a[1].toLowerCase())).forEach(n => { c.ln(n + '/jammy ' + pk.avail[n].v + ' amd64' + (pk.inst[n] ? ' [installed]' : '')); c.ln('  ' + pk.avail[n].d); c.ln(''); }); return 0; }
    if (sub === 'show') { const n = a[1]; if (!pk.avail[n]) { c.er('E: No packages found', 'NOPKG'); return 100; } c.ln('Package: ' + n); c.ln('Version: ' + pk.avail[n].v); c.ln('Description: ' + pk.avail[n].d); return 0; }
    c.er("E: Invalid operation " + sub, 'USAGE'); return 100;
  }
  def(['apt', 'apt-get'], 'apt update | upgrade | install PAKET | remove PAKET | search BEGRIFF | list --installed', c => aptRun(c));
  def('dpkg', 'dpkg -l   |   dpkg -s PAKET', c => {
    const pk = c.sys.pkgs; if (c.args[0] === '-l') { c.ln('Desired=Unknown/Install/Remove/Purge/Hold'); c.ln('||/ Name           Version      Architecture Description'); Object.keys(pk.inst).sort().forEach(n => c.ln('ii  ' + pad(n, 14) + ' ' + pad(pk.inst[n], 12) + ' amd64        ' + (pk.avail[n] ? pk.avail[n].d : ''))); return 0; }
    if (c.args[0] === '-s' && c.args[1]) { if (!pk.inst[c.args[1]]) { c.er("dpkg-query: package '" + c.args[1] + "' is not installed and no information is available"); return 1; } c.ln('Package: ' + c.args[1]); c.ln('Status: install ok installed'); c.ln('Version: ' + pk.inst[c.args[1]]); return 0; }
    c.er('dpkg: error: need an action option', 'USAGE'); return 2;
  });
  def('tree', 'tree [Ordner]', c => {
    const p = c.args.find(a => a[0] !== '-') || '.', w = c.get(p); if (w.err) { c.er(p + ' [error opening dir]'); return 2; } let nd = 0, nf = 0;
    const rec = (n, pre) => { const ks = Object.keys(n.ch).filter(k => k[0] !== '.').sort(lsCmp); ks.forEach((k, i) => { const last = i === ks.length - 1; c.ln(pre + (last ? '└── ' : '├── ') + k); if (n.ch[k].t === 'd') { nd++; if (c.can(n.ch[k], 4)) rec(n.ch[k], pre + (last ? '    ' : '│   ')); } else nf++; }); };
    c.ln(p); if (w.n.t === 'd') rec(w.n, ''); c.ln(''); c.ln(nd + ' director' + (nd === 1 ? 'y' : 'ies') + ', ' + nf + ' file' + (nf === 1 ? '' : 's'));
  }, { pkg: 'tree' });
  def('cowsay', 'cowsay Text', c => { const t = c.args.join(' ') || 'Moo'; c.ln(' ' + '_'.repeat(t.length + 2)); c.ln('< ' + t + ' >'); c.ln(' ' + '-'.repeat(t.length + 2)); c.ln('        \\   ^__^'); c.ln('         \\  (oo)\\_______'); c.ln('            (__)\\       )\\/\\'); c.ln('                ||----w |'); c.ln('                ||     ||'); }, { pkg: 'cowsay' });
  ['htop', 'curl', 'nmap', 'vim'].forEach(n => def(n, null, c => { c.er('bash: ' + n + ': ' + 'Das Programm ist installiert, wird aber im Lab nicht simuliert.', 'SIM'); return 1; }, { pkg: n }));
  /* ---------- awk (einfache Form) ---------- */
  /* PRUEFEN P28: awk und sed werden nur in einfacher Form simuliert (awk: print, $N, $NF, NR, -F, Muster, Summen mit END; sed: s///g, p, d, q, Adressen). Fehlermeldungen folgen mawk (Ubuntu) bzw. GNU sed. Reicht dieser Umfang? */
  const AWK_SYN = { syn: 1 }, AWK_UNS = { uns: 1 };
  const AWK_KW = new Set(['print', 'printf', 'if', 'else', 'for', 'while', 'do', 'next', 'exit', 'getline', 'delete', 'function', 'return', 'break', 'continue', 'nextfile', 'in', 'BEGIN', 'END']);
  const AWK_FN = { length: 1, toupper: 1, tolower: 1, substr: 1, int: 1 };
  const awkLooks = s => /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(s);
  const awkNum = s => { const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(String(s)); return m ? parseFloat(m[0]) : 0; };
  const awkFmt = v => { if (!fin(v)) return v !== v ? 'nan' : (v > 0 ? 'inf' : '-inf'); if (Number.isInteger(v) && Math.abs(v) < 1e16) return String(v); return String(parseFloat(v.toPrecision(6))); };
  /* Werte: Zahl, Text oder {sn: Text} (Feld, das wie eine Zahl aussieht), undefined = nicht gesetzt */
  const aN = v => (v === undefined ? 0 : typeof v === 'number' ? v : typeof v === 'string' ? awkNum(v) : awkNum(v.sn));
  const aS = v => (v === undefined ? '' : typeof v === 'number' ? awkFmt(v) : typeof v === 'string' ? v : v.sn);
  const aB = v => (v === undefined ? false : typeof v === 'number' ? v !== 0 : typeof v === 'string' ? v !== '' : awkNum(v.sn) !== 0);
  const aIsNum = v => v === undefined || typeof v === 'number' || typeof v === 'object';
  const mkF = s => (awkLooks(s) ? { sn: s } : s);
  const awkReOf = s => { try { return new RegExp(s.replace(/\[:(\w+):\]/g, (m, k) => POSIX[k] || m)); } catch (ex) { throw AWK_SYN; } };
  function awkLex(src) {
    const T = [], n = src.length; let i = 0;
    const opEnd = () => { const l = T[T.length - 1]; return !!l && (l.t === 'num' || l.t === 'str' || l.t === 'name' || (l.t === 'op' && l.v === ')')); };
    while (i < n) {
      const ch = src[i], rest = src.slice(i); let m;
      if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
      if (ch === '\n') { T.push({ t: 'op', v: ';' }); i++; continue; }
      if (ch === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(rest))) { T.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_]\w*/.exec(rest))) { T.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
      if (ch === '"') {
        let s = '', j = i + 1;
        for (; j < n && src[j] !== '"'; j++) { if (src[j] === '\n') throw AWK_SYN; if (src[j] === '\\' && j + 1 < n) { const e = src[++j]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === '"' ? '"' : e === '/' ? '/' : '\\' + e; } else s += src[j]; }
        if (j >= n) throw AWK_SYN; T.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      if (ch === '/' && !opEnd()) {
        let s = '', j = i + 1;
        for (; j < n && src[j] !== '/'; j++) { if (src[j] === '\n') throw AWK_SYN; if (src[j] === '\\' && j + 1 < n) { if (src[j + 1] === '/') s += '/'; else s += src[j] + src[j + 1]; j++; } else s += src[j]; }
        if (j >= n) throw AWK_SYN; T.push({ t: 're', v: s }); i = j + 1; continue;
      }
      const two = rest.slice(0, 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '++', '--', '!~', '>>'].includes(two)) { T.push({ t: 'op', v: two }); i += 2; continue; }
      if ('{}()[];,$+-*/%<>~!=?:|^'.includes(ch)) { T.push({ t: 'op', v: ch }); i++; continue; }
      throw AWK_SYN;
    }
    return T;
  }
  function awkParse(src) {
    const T = awkLex(src); let p = 0, noGt = false;
    const isOp = v => !!T[p] && T[p].t === 'op' && T[p].v === v;
    const eat = v => { if (isOp(v)) { p++; return true; } return false; };
    const need = v => { if (!eat(v)) throw AWK_SYN; };
    const skipSep = () => { while (isOp(';')) p++; };
    const expr = ng => { const sv = noGt; noGt = ng; try { return orE(); } finally { noGt = sv; } };
    const orE = () => { let l = andE(); while (eat('||')) l = { k: 'or', l, r: andE() }; return l; };
    const andE = () => { let l = matE(); while (eat('&&')) l = { k: 'and', l, r: matE() }; return l; };
    const matE = () => { let l = cmpE(); while (isOp('~') || isOp('!~')) { const neg = T[p++].v === '!~'; l = { k: 'mat', l, r: cmpE(), neg }; } return l; };
    const cmpE = () => { const l = catE(), t = T[p]; if (t && t.t === 'op' && ['<', '<=', '==', '!=', '>', '>='].includes(t.v) && !(t.v === '>' && noGt)) { p++; return { k: 'cmp', op: t.v, l, r: catE() }; } return l; };
    const startsOperand = () => { const t = T[p]; if (!t) return false; if (t.t === 'num' || t.t === 'str') return true; if (t.t === 'name') return !AWK_KW.has(t.v); return t.t === 'op' && (t.v === '$' || t.v === '('); };
    const catE = () => { let l = addE(); while (startsOperand()) l = { k: 'cat', l, r: addE() }; return l; };
    const addE = () => { let l = mulE(); while (isOp('+') || isOp('-')) { const o = T[p++].v; l = { k: 'bin', o, l, r: mulE() }; } return l; };
    const mulE = () => { let l = unE(); while (isOp('*') || isOp('/') || isOp('%')) { const o = T[p++].v; l = { k: 'bin', o, l, r: unE() }; } return l; };
    const unE = () => { if (eat('!')) return { k: 'not', e: unE() }; if (eat('-')) return { k: 'neg', e: unE() }; if (eat('+')) return { k: 'pos', e: unE() }; return prim(); };
    const prim = () => {
      const t = T[p]; if (!t) throw AWK_SYN;
      if (t.t === 'num' || t.t === 'str') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 're') { p++; return { k: 're', re: awkReOf(t.v) }; }
      if (t.t === 'op') {
        if (t.v === '$') { p++; return { k: 'fld', e: prim() }; }
        if (t.v === '(') { p++; const e = expr(false); need(')'); return { k: 'grp', e }; }
        if (t.v === '?' || t.v === '[' || t.v === '|' || t.v === '^') throw AWK_UNS;
        throw AWK_SYN;
      }
      if (AWK_KW.has(t.v)) throw AWK_UNS;
      p++;
      if (isOp('(')) { if (!AWK_FN[t.v]) throw AWK_UNS; p++; const a = []; if (!isOp(')')) { a.push(expr(false)); while (eat(',')) a.push(expr(false)); } need(')'); return { k: 'fn', nm: t.v, a }; }
      if (isOp('[')) throw AWK_UNS;
      if (t.v === 'length') return { k: 'fn', nm: 'length', a: [] };
      return { k: 'var', nm: t.v };
    };
    const stmt = () => {
      const t = T[p];
      if (t.t === 'name') {
        if (t.v === 'print') {
          p++; const a = [];
          if (isOp('>') || isOp('>>') || isOp('|')) throw AWK_UNS;
          if (!isOp(';') && !isOp('}') && p < T.length) { a.push(expr(true)); while (eat(',')) a.push(expr(true)); }
          if (isOp('>') || isOp('>>') || isOp('|')) throw AWK_UNS;
          return { k: 'print', a };
        }
        if (AWK_KW.has(t.v)) throw AWK_UNS;
        p++; const nx = T[p];
        if (nx && nx.t === 'op') {
          if (['=', '+=', '-=', '*=', '/=', '%='].includes(nx.v)) { p++; return { k: 'set', nm: t.v, o: nx.v, e: expr(false) }; }
          if (nx.v === '++' || nx.v === '--') { p++; return { k: 'inc', nm: t.v, d: nx.v === '++' ? 1 : -1 }; }
        }
        throw AWK_UNS;
      }
      if (t.t === 'op' && (t.v === '++' || t.v === '--')) { p++; const nm = T[p]; if (!nm || nm.t !== 'name') throw AWK_SYN; p++; return { k: 'inc', nm: nm.v, d: t.v === '++' ? 1 : -1 }; }
      throw AWK_UNS;
    };
    const stmts = () => {
      const L = []; skipSep();
      while (!isOp('}')) { if (p >= T.length) throw AWK_SYN; L.push(stmt()); if (!isOp('}') && !isOp(';')) throw (isOp('?') || isOp('[') || isOp('|') ? AWK_UNS : AWK_SYN); skipSep(); }
      return L;
    };
    const prog = { begin: [], main: [], end: [] }; skipSep();
    while (p < T.length) {
      let pat = null, kind = 'main';
      if (T[p].t === 'name' && (T[p].v === 'BEGIN' || T[p].v === 'END')) { kind = T[p].v === 'BEGIN' ? 'begin' : 'end'; p++; if (!isOp('{')) throw AWK_SYN; }
      else if (!isOp('{')) { pat = expr(false); if (isOp(',')) throw AWK_UNS; }
      let body = null;
      if (isOp('{')) { p++; body = stmts(); need('}'); }
      prog[kind].push({ pat, body }); skipSep();
    }
    return prog;
  }
  function awkSplit(line, FS) {
    if (FS === ' ') { const t = line.replace(/^[ \t\n]+|[ \t\n]+$/g, ''); return t ? t.split(/[ \t\n]+/) : []; }
    if (line === '') return [];
    if (FS.length === 1) return line.split(FS);
    let re; try { re = new RegExp(FS.replace(/\[:(\w+):\]/g, (m, k) => POSIX[k] || m), 'g'); } catch (ex) { return [line]; }
    const out = []; let last = 0, m; while ((m = re.exec(line)) && m[0] !== '') { out.push(line.slice(last, m.index)); last = m.index + m[0].length; } out.push(line.slice(last)); return out;
  }
  const AWK_UNSMSG = 'awk: Dieser awk-Ausdruck wird im Lab nicht simuliert.';
  def('awk', "awk [-F Trenner] [-v var=wert] 'Programm' [Datei]...   (einfache Form: print $1, Muster, NR, Summen mit END)", c => {
    const a = c.args; let FS = ' ', i = 0; const vars = {};
    for (; i < a.length; i++) {
      const x = a[i];
      if (x === '--') { i++; break; }
      if (x === '-F' || x === '-v') { if (i + 1 >= a.length) { c.er("awk: option requires an argument -- '" + x[1] + "'", 'USAGE'); return 2; } const val = a[++i]; if (x === '-F') FS = val; else { const eq = val.indexOf('='); if (eq < 1) { c.er('awk: improper assignment: -v ' + val, 'USAGE'); return 2; } vars[val.slice(0, eq)] = mkF(val.slice(eq + 1)); } continue; }
      if (x.startsWith('-F') && x.length > 2) { FS = x.slice(2); continue; }
      if (x.startsWith('-v') && x.length > 2) { const eq = x.indexOf('='); if (eq < 3) { c.er('awk: improper assignment: ' + x, 'USAGE'); return 2; } vars[x.slice(2, eq)] = mkF(x.slice(eq + 1)); continue; }
      if (x === '-f' || x === '--file' || x === '-W') { c.er(AWK_UNSMSG, 'AWKSIM'); return 2; }
      if (x[0] === '-' && x.length > 1) { c.er("awk: invalid option -- '" + x.replace(/^-+/, '')[0] + "'", 'OPT'); return 2; }
      break;
    }
    if (i >= a.length) { c.er('Usage: awk [-F fs] [-v var=value] \'program\' [file ...]', 'USAGE'); return 2; }
    const src = a[i++], files = a.slice(i);
    let prog;
    try { prog = awkParse(src); } catch (ex) {
      if (ex === AWK_UNS) { c.er(AWK_UNSMSG, 'AWKSIM'); return 2; }
      c.er('awk: line 1: syntax error', 'Hinweis: Das awk-Programm ist falsch aufgebaut. Das Programm steht in einfachen Anführungszeichen, Anweisungen in geschweiften Klammern: awk \'{print $1}\' datei. Prüfe Klammern und Anführungszeichen.'); return 2;
    }
    if (FS.length > 1 && FS === '\\t') FS = '\t';
    const S = { v: Object.assign({}, vars), NR: 0, FNR: 0, f: [], line: '', file: '' }; if (FS !== ' ') S.v.FS = FS; else if (S.v.FS === undefined) S.v.FS = ' ';
    const out = [];
    const ofs = () => (S.v.OFS === undefined ? ' ' : aS(S.v.OFS));
    const ev = e => {
      switch (e.k) {
        case 'lit': return e.v;
        case 're': return e.re.test(S.line) ? 1 : 0;
        case 'grp': return ev(e.e);
        case 'fld': { const n = Math.trunc(aN(ev(e.e))); if (n === 0) return mkF(S.line); if (n < 0) return ''; return n > S.f.length ? undefined : mkF(S.f[n - 1]); }
        case 'var': return e.nm === 'NR' ? S.NR : e.nm === 'NF' ? S.f.length : e.nm === 'FNR' ? S.FNR : e.nm === 'FILENAME' ? S.file : S.v[e.nm];
        case 'cat': return aS(ev(e.l)) + aS(ev(e.r));
        case 'bin': { const x = aN(ev(e.l)), y = aN(ev(e.r)); if ((e.o === '/' || e.o === '%') && y === 0) throw { run: 'division by zero' }; return e.o === '+' ? x + y : e.o === '-' ? x - y : e.o === '*' ? x * y : e.o === '/' ? x / y : x % y; }
        case 'neg': return -aN(ev(e.e));
        case 'pos': return aN(ev(e.e));
        case 'not': return aB(ev(e.e)) ? 0 : 1;
        case 'or': return aB(ev(e.l)) || aB(ev(e.r)) ? 1 : 0;
        case 'and': return aB(ev(e.l)) && aB(ev(e.r)) ? 1 : 0;
        case 'mat': { const s = aS(ev(e.l)), re = e.r.k === 're' ? e.r.re : awkReOf(aS(ev(e.r))); return re.test(s) !== e.neg ? 1 : 0; }
        case 'cmp': {
          const x = ev(e.l), y = ev(e.r); let r;
          if (aIsNum(x) && aIsNum(y)) { const p = aN(x), q = aN(y); r = p < q ? -1 : p > q ? 1 : 0; } else { const p = aS(x), q = aS(y); r = p < q ? -1 : p > q ? 1 : 0; }
          return (e.op === '<' ? r < 0 : e.op === '<=' ? r <= 0 : e.op === '==' ? r === 0 : e.op === '!=' ? r !== 0 : e.op === '>' ? r > 0 : r >= 0) ? 1 : 0;
        }
        case 'fn': {
          const A = e.a.map(ev);
          if (e.nm === 'length') return [...(A.length ? aS(A[0]) : S.line)].length;
          if (e.nm === 'toupper') return aS(A[0]).toUpperCase();
          if (e.nm === 'tolower') return aS(A[0]).toLowerCase();
          if (e.nm === 'int') return Math.trunc(aN(A[0]));
          const s = aS(A[0]), m = Math.round(aN(A[1])), len = A.length > 2 ? Math.round(aN(A[2])) : Infinity;
          const from = Math.max(m, 1), to = len === Infinity ? s.length : m + len - 1; return s.slice(from - 1, Math.max(to, 0));
        }
      }
      return undefined;
    };
    const exec = L => {
      for (const s of L) {
        if (s.k === 'print') out.push((s.a.length ? s.a.map(x => aS(ev(x))).join(ofs()) : S.line) + '\n');
        else if (s.k === 'set') {
          const v = ev(s.e);
          if (s.o === '=') S.v[s.nm] = v;
          else { const x = aN(S.v[s.nm]), y = aN(v); if ((s.o === '/=' || s.o === '%=') && y === 0) throw { run: 'division by zero' }; S.v[s.nm] = s.o === '+=' ? x + y : s.o === '-=' ? x - y : s.o === '*=' ? x * y : s.o === '/=' ? x / y : x % y; }
        } else S.v[s.nm] = aN(S.v[s.nm]) + s.d;
      }
    };
    const runItems = L => { for (const it of L) { if (!it.pat || aB(ev(it.pat))) { if (it.body) exec(it.body); else out.push(S.line + '\n'); } } };
    const flush = () => { c.o(out.join('')); out.length = 0; };
    try {
      prog.begin.forEach(it => { if (it.body) exec(it.body); });
      if (prog.main.length || prog.end.length) {
        const srcs = files.length ? files : ['-'];
        for (const f of srcs) {
          let text;
          if (f === '-') text = c.stdin;
          else {
            const w = c.get(f);
            if (w.err) { flush(); c.er('awk: cannot open ' + f + ' (' + ETXT[w.err] + ')', w.err); return 2; }
            if (w.n.t === 'd') { flush(); c.er('awk: read error (' + ETXT.EISDIR + ')', 'EISDIR'); return 2; }
            if (!w.n.dev && !c.can(w.n, 4)) { flush(); c.er('awk: cannot open ' + f + ' (' + ETXT.EACCES + ')', 'EACCES'); return 2; }
            text = w.n.dev ? '' : w.n.content;
          }
          S.file = f === '-' ? '' : f; S.FNR = 0;
          for (const ln of textLines(text)) { S.NR++; S.FNR++; S.line = ln; S.f = awkSplit(ln, S.v.FS === undefined ? ' ' : aS(S.v.FS)); runItems(prog.main); }
        }
        runItems(prog.end);
      }
    } catch (ex) {
      flush();
      if (ex && ex.run) { c.er('awk: ' + ex.run, 'Hinweis: Durch null kann man nicht teilen. Prüfe den Teiler.'); return 2; }
      if (ex === AWK_SYN) { c.er('awk: line 1: syntax error', 'Hinweis: Das awk-Programm ist falsch aufgebaut. Prüfe Klammern, Anführungszeichen und reguläre Ausdrücke.'); return 2; }
      throw ex;
    }
    flush(); return 0;
  });

  /* ---------- sed (einfache Form) ---------- */
  const SED_USAGE = 'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...';
  function sedErrRe(pat, ere) {
    return ere ? (/\(/.test(pat) && !/\)/.test(pat) ? 'Unmatched ( or \\(' : /\)/.test(pat) && !/\(/.test(pat) ? 'Unmatched ) or \\)' : /\[/.test(pat) ? 'Unmatched [, [^, [:, [., or [=' : 'Invalid preceding regular expression')
      : (/\\\(/.test(pat) && !/\\\)/.test(pat) ? 'Unmatched ( or \\(' : /\\\)/.test(pat) && !/\\\(/.test(pat) ? 'Unmatched ) or \\)' : /\[/.test(pat) ? 'Unmatched [, [^, [:, [., or [=' : 'Invalid preceding regular expression');
  }
  /* Skript zerlegen; wirft {msg} (Fehlertext nach "char N: ") oder {uns} */
  function sedParse(s, ere) {
    const cmds = []; let i = 0; const n = s.length;
    const E = (m, at) => ({ msg: m, at: at == null ? i : at });
    const delimRead = (d, what) => {
      let out = '';
      for (; i < n; i++) {
        const ch = s[i];
        if (ch === '\\' && i + 1 < n) { if (s[i + 1] === d) { out += d; i++; } else { out += ch + s[i + 1]; i++; } continue; }
        if (ch === d) { i++; return out; }
        if (ch === '\n' && what === 'p') break;
        out += ch;
      }
      throw E("unterminated `s' command", n);
    };
    const addr = () => {
      const ch = s[i];
      if (ch >= '0' && ch <= '9') { const m = /^\d+/.exec(s.slice(i)); i += m[0].length; if (s[i] === '~') throw { uns: 1 }; if (+m[0] === 0) throw E('invalid usage of line address 0'); return { t: 'n', n: +m[0] }; }
      if (ch === '$') { i++; return { t: '$' }; }
      if (ch === '/') {
        i++; let out = '';
        for (; i < n; i++) { const c2 = s[i]; if (c2 === '\\' && i + 1 < n) { if (s[i + 1] === '/') out += '/'; else out += c2 + s[i + 1]; i++; continue; } if (c2 === '/') break; out += c2; }
        if (i >= n) throw E('unterminated address regex', n);
        i++; if (s[i] === 'I' || s[i] === 'M') throw { uns: 1 };
        if (out === '') throw { uns: 1 };
        let re; try { re = toRegex(out, { E: ere }); } catch (ex) { throw E(sedErrRe(out, ere)); }
        return { t: 're', re };
      }
      return null;
    };
    for (;;) {
      while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === ';' || s[i] === '\n')) i++;
      if (i >= n) break;
      const cm = { a1: null, a2: null, neg: false, active: false };
      cm.a1 = addr();
      if (cm.a1 && s[i] === ',') { i++; if (s[i] === '+' || s[i] === '~') throw { uns: 1 }; cm.a2 = addr(); if (!cm.a2) throw E('unexpected `,\'', i + 1); }
      while (s[i] === ' ') i++;
      while (s[i] === '!') { cm.neg = true; i++; while (s[i] === ' ') i++; }
      if (i >= n) throw E('missing command', n);
      const ch = s[i++]; cm.c = ch;
      if (ch === 's') {
        if (i >= n) throw E("unterminated `s' command", n);
        const d = s[i++]; if (d === '\n' || d === '\\') throw E("unterminated `s' command", n);
        const pat = delimRead(d, 's'), rep = delimRead(d, 's'); cm.g = false; cm.p = false; let ic = false;
        for (; i < n; i++) {
          const f = s[i];
          if (f === 'g') cm.g = true; else if (f === 'p') cm.p = true; else if (f === 'I' || f === 'i') ic = true;
          else if (f === ';' || f === '\n' || f === '}') break; else if (f === ' ') continue;
          else if (/[0-9wemME]/.test(f)) throw { uns: 1 };
          else throw E("unknown option to `s'", i + 1);
        }
        if (pat === '') throw { uns: 1 };
        let re; try { re = toRegex(pat, { E: ere, i: ic }); } catch (ex) { throw E(sedErrRe(pat, ere)); }
        cm.re = new RegExp(re.source, (cm.g ? 'g' : '') + (ic ? 'i' : ''));
        const ng = new RegExp(re.source + '|').exec('').length - 1; cm.rep = [];
        for (let k = 0; k < rep.length; k++) {
          const r = rep[k];
          if (r === '&') cm.rep.push({ t: 'a' });
          else if (r === '\\' && k + 1 < rep.length) {
            const x = rep[++k];
            if (/[0-9]/.test(x)) { if (+x > ng) throw E("invalid reference \\" + x + " on `s' command's RHS"); cm.rep.push(+x === 0 ? { t: 'a' } : { t: 'g', n: +x }); }
            else cm.rep.push({ t: 'l', s: x === 'n' ? '\n' : x === 't' ? '\t' : x });
          } else cm.rep.push({ t: 'l', s: r });
        }
      } else if (ch === 'p' || ch === 'd' || ch === 'q') {
        while (s[i] === ' ') i++;
        if (ch === 'q' && /[0-9]/.test(s[i] || '')) throw { uns: 1 };
        if (i < n && s[i] !== ';' && s[i] !== '\n' && s[i] !== '}') throw E('extra characters after command', i + 1);
      } else if ('aicyDGgHhlNnPrwxzF=bt:{'.includes(ch)) throw { uns: 1 };
      else if (ch === '}') throw E("unexpected `}'", i);
      else if (ch === '#') { while (i < n && s[i] !== '\n') i++; continue; }
      else throw E("unknown command: `" + ch + "'", i);
      cmds.push(cm);
    }
    return cmds;
  }
  function sedStream(cmds, units, quiet) {
    let out = '', no = 0, quit = false; cmds.forEach(cm => { cm.active = false; });
    const total = units.reduce((a, u) => a + u.length, 0); let seen = 0;
    const hit = (a, ps, last) => (a.t === 'n' ? no === a.n : a.t === '$' ? last : a.re.test(ps));
    const sel = (cm, ps, last) => {
      let r;
      if (!cm.a1) r = true;
      else if (!cm.a2) r = hit(cm.a1, ps, last);
      else if (cm.active) {
        r = true; const e = cm.a2;
        if (e.t === 'n') { if (no >= e.n) cm.active = false; } else if (e.t === '$') { if (last) cm.active = false; } else if (e.re.test(ps)) cm.active = false;
      } else if (hit(cm.a1, ps, last)) {
        r = true; const e = cm.a2;
        if (e.t === 'n') { if (e.n > no) cm.active = true; } else if (e.t === '$') { if (!last) cm.active = true; } else cm.active = true;
      } else r = false;
      return cm.neg ? !r : r;
    };
    for (const lines of units) {
      for (const line of lines) {
        if (quit) break;
        no++; seen++; let ps = line, del = false; const last = seen === total;
        for (const cm of cmds) {
          if (!sel(cm, ps, last)) continue;
          if (cm.c === 'p') out += ps + '\n';
          else if (cm.c === 'd') { del = true; break; }
          else if (cm.c === 'q') { quit = true; break; }
          else if (cm.c === 's') {
            let did = false;
            const res = ps.replace(cm.re, (...m) => { did = true; const gr = m.slice(1, m.length - 2); return cm.rep.map(r => (r.t === 'l' ? r.s : r.t === 'a' ? m[0] : (gr[r.n - 1] === undefined ? '' : gr[r.n - 1]))).join(''); });
            if (did) { ps = res; if (cm.p) out += ps + '\n'; }
          }
        }
        if (!del && !quiet) out += ps + '\n';
      }
    }
    return out;
  }
  def('sed', "sed [-n] [-E] [-i] [-e] 'Skript' [Datei]...   (s/alt/neu/g, Np, Nd, /muster/d)", c => {
    const a = c.args; let quiet = false, ere = false, inplace = false, suffix = '', code = 0; const scripts = [], rest = []; let end = false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (end || x === '-' || x[0] !== '-') { rest.push(x); continue; }
      if (x === '--') { end = true; continue; }
      if (x.startsWith('--')) {
        const nm = x.slice(2).split('=')[0], eq = x.indexOf('=');
        if (nm === 'quiet' || nm === 'silent') quiet = true; else if (nm === 'regexp-extended') ere = true; else if (nm === 'separate') continue;
        else if (nm === 'in-place') { inplace = true; if (eq > 0) suffix = x.slice(eq + 1); } else if (nm === 'expression') { if (eq > 0) scripts.push(x.slice(eq + 1)); else if (i + 1 < a.length) scripts.push(a[++i]); else { c.er("sed: option '--expression' requires an argument", 'USAGE'); c.er(SED_USAGE); return 1; } }
        else { c.er("sed: unrecognized option '" + x + "'", 'OPT'); c.er(SED_USAGE); return 1; }
        continue;
      }
      for (let j = 1; j < x.length; j++) {
        const ch = x[j];
        if (ch === 'n') quiet = true; else if (ch === 'E' || ch === 'r') ere = true; else if (ch === 's') continue;
        else if (ch === 'i') { inplace = true; suffix = x.slice(j + 1); break; }
        else if (ch === 'e') { const r = x.slice(j + 1); if (r) scripts.push(r); else if (i + 1 < a.length) scripts.push(a[++i]); else { c.er("sed: option requires an argument -- 'e'", 'USAGE'); c.er(SED_USAGE); return 1; } break; }
        else if (ch === 'f') { c.er('sed: Option -f wird im Lab nicht simuliert.', 'SEDSIM'); return 1; }
        else { c.er("sed: invalid option -- '" + ch + "'", 'OPT'); c.er(SED_USAGE); return 1; }
      }
    }
    if (!scripts.length) { if (!rest.length) { c.er(SED_USAGE, 'USAGE'); return 1; } scripts.push(rest.shift()); }
    let cmds = [];
    for (let k = 0; k < scripts.length; k++) {
      try { cmds = cmds.concat(sedParse(scripts[k], ere)); } catch (ex) {
        if (ex && ex.uns) { c.er('sed: Dieser sed-Befehl wird im Lab nicht simuliert.', 'SEDSIM'); return 1; }
        if (ex && ex.msg) { c.er('sed: -e expression #' + (k + 1) + ', char ' + ex.at + ': ' + ex.msg, 'Hinweis: Das sed-Skript ist falsch aufgebaut. Typisch: s/alt/neu/ mit drei Schrägstrichen, p zum Ausgeben, d zum Löschen, davor optional eine Zeilennummer. Das Skript steht in einfachen Anführungszeichen.'); return 1; }
        throw ex;
      }
    }
    if (inplace && !rest.length) { c.er('sed: no input files', 'USAGE'); return 1; }
    const load = p => {
      if (p === '-') return { text: c.stdin };
      const w = c.get(p);
      if (w.err) { c.er("sed: can't read " + p + ': ' + ETXT[w.err], w.err); code = 2; return null; }
      if (w.n.t === 'd') { c.er(inplace ? "sed: couldn't edit " + p + ': not a regular file' : 'sed: read error on ' + p + ': ' + ETXT.EISDIR, 'EISDIR'); code = inplace ? 4 : 2; return null; }
      if (!w.n.dev && !c.can(w.n, 4)) { c.er("sed: can't read " + p + ': ' + ETXT.EACCES, 'EACCES'); code = 2; return null; }
      return { text: w.n.dev ? '' : w.n.content, node: w.n, abs: w.abs };
    };
    if (!inplace) {
      const units = [], srcs = rest.length ? rest : ['-'];
      srcs.forEach(p => { const r = load(p); if (r) units.push(textLines(r.text)); });
      c.o(sedStream(cmds, units, quiet)); return code;
    }
    rest.forEach(p => {
      const r = load(p); if (!r || r.node.dev) return;
      const par = parentOf(c.sys, r.abs, c.user);
      if (par.err || !c.can(par.dir, 2)) { const d = p.includes('/') ? p.replace(/\/[^/]*$/, '') || '/' : '.'; c.er("sed: couldn't open temporary file " + d + '/sedFx3K9a: ' + ETXT.EACCES, 'EACCES'); code = 4; return; }
      const res = sedStream(cmds, [textLines(r.text)], quiet);
      if (suffix) { const bn = suffix.includes('*') ? suffix.replace(/\*/g, basename(r.abs)) : basename(r.abs) + suffix; const nb = mkNode('f', r.node.mode, c.user, primGroup(c.sys, c.user), r.text); par.dir.ch[bn] = nb; }
      r.node.content = res; r.node.mt = NOW;
    });
    return code;
  });

  /* ---------- systemctl (kleine simulierte Dienstliste) ---------- */
  /* PRUEFEN P29: systemctl simuliert eine kleine Dienstliste (ssh, cron, nginx, rsyslog, fail2ban). status zeigt nur die wichtigsten Zeilen (Loaded, Active, Main PID). start/stop/restart/enable/disable gehen nur als root (sudo), sonst "Interactive authentication required." (echtes Ubuntu fragt im Terminal oft per Passwortdialog). Ausgaben von enable/disable (SysV-Zeilen, Symlinks) sind vereinfacht. Passt das zum Unterricht? */
  const SVC_AT = 'Sun 2026-11-08 09:30:20 CET; 5s ago';
  const svcUnit = nm => (/\.[a-z]+$/.test(nm) ? nm : nm + '.service');
  function svcFind(sys, nm) {
    if (!/\.service$/.test(svcUnit(nm))) return null; const base = svcUnit(nm).replace(/\.service$/, '');
    const k = Object.keys(sys.svc).find(x => x === base || (sys.svc[x].alias || []).includes(base)); return k ? sys.svc[k] : null;
  }
  function svcStop(sys, s) {
    if (!s.on) return; s.on = false; s.failed = false; s.since = SVC_AT;
    const gone = sys.procs.filter(p => p.pid === s.pid || p.ppid === s.pid).map(p => p.pid); sys.procs = sys.procs.filter(p => !gone.includes(p.pid));
    s.sock = sys.sockets.filter(k => k.pid === s.pid && k.state === 'LISTEN'); sys.sockets = sys.sockets.filter(k => !(k.pid === s.pid && k.state === 'LISTEN')); s.pid = 0;
  }
  function svcStart(sys, s) {
    if (s.on) return; s.on = true; s.failed = false; s.since = SVC_AT;
    const pid = sys.nextPid++, base = { ppid: 1, cpu: 0, mem: 0.1, vsz: 10000, rss: 3000, tty: '?', stat: 'Ss', start: '09:30', time: '0:00' }; s.pid = pid;
    sys.procs.push(Object.assign({}, base, { pid, user: s.user || 'root', cmd: s.cmd }));
    if (s.worker) sys.procs.push(Object.assign({}, base, { pid: sys.nextPid++, ppid: pid, user: s.worker.user, cmd: s.worker.cmd }));
    (s.sock || []).forEach(k => sys.sockets.push(Object.assign({}, k, { pid }))); s.sock = [];
  }
  def('systemctl', 'systemctl status|start|stop|restart|enable|disable|is-active|is-enabled DIENST...   |   systemctl list-units [--all]', c => {
    const sys = c.sys, O = {}; let verb = null; const names = [];
    for (let i = 0; i < c.args.length; i++) {
      const x = c.args[i];
      if (x.startsWith('--')) {
        const nm = x.slice(2).split('=')[0], eq = x.indexOf('=');
        if (['no-pager', 'full', 'plain', 'no-legend', 'quiet', 'now', 'all', 'failed'].includes(nm)) O[nm] = true; else if ((nm === 'type' || nm === 'state') && eq > 0) O[nm] = x.slice(eq + 1);
        else { c.er("systemctl: unrecognized option '" + x + "'", 'OPT'); return 1; }
      } else if (x.length > 1 && x[0] === '-') {
        for (let j = 1; j < x.length; j++) { const ch = x[j]; if (ch === 'l') O.full = true; else if (ch === 'a') O.all = true; else if (ch === 'q') O.quiet = true; else if (ch === 't') { O.type = x.slice(j + 1) || c.args[++i]; break; } else { c.er("systemctl: invalid option -- '" + ch + "'", 'OPT'); return 1; } }
      } else if (verb === null) verb = x; else names.push(x);
    }
    if (verb === null) verb = 'list-units';
    const act = s => (s.on ? 'active' : s.failed ? 'failed' : 'inactive');
    if (verb === 'list-units') {
      const type = O.type || 'service'; let L = type === 'service' ? Object.keys(sys.svc).sort().map(k => sys.svc[k]) : [];
      if (O.failed) L = L.filter(s => s.failed); else if (!O.all) L = L.filter(s => s.on || s.failed);
      if (O.state) L = L.filter(s => act(s) === O.state);
      const rows = L.map(s => [s.n + '.service', 'loaded', act(s), s.on ? 'running' : s.failed ? 'failed' : 'dead', s.d, s.failed]);
      if (!O['no-legend']) {
        const w0 = Math.max(4, ...rows.map(r => r[0].length)), w3 = Math.max(3, ...rows.map(r => r[3].length));
        c.ln('  ' + pad('UNIT', w0) + ' ' + pad('LOAD', 6) + ' ' + pad('ACTIVE', 6) + ' ' + pad('SUB', w3) + ' DESCRIPTION');
        rows.forEach(r => c.ln((r[5] ? '● ' : '  ') + pad(r[0], w0) + ' ' + pad(r[1], 6) + ' ' + pad(r[2], 6) + ' ' + pad(r[3], w3) + ' ' + r[4]));
        c.ln(''); c.ln('LOAD   = Reflects whether the unit definition was properly loaded.'); c.ln('ACTIVE = The high-level unit activation state, i.e. generalization of SUB.'); c.ln('SUB    = The low-level unit activation state, values depend on unit type.'); c.ln('');
        c.ln(rows.length + ' loaded units listed.' + (O.all || O.failed ? '' : ' Pass --all to see loaded but inactive units, too.')); c.ln("To show all installed unit files use 'systemctl list-unit-files'.");
      } else rows.forEach(r => c.ln(pad(r[0], Math.max(...rows.map(q => q[0].length))) + ' ' + pad(r[1], 6) + ' ' + pad(r[2], 6) + ' ' + r[3] + ' ' + r[4]));
      c.hint('Hinweis: Das echte list-units zeigt alle Einheiten des Systems (Dienste, Sockets, Timer ...). Das Lab zeigt nur die Dienste (service). Ohne --all stehen nur laufende und fehlgeschlagene Dienste in der Liste.'); return 0;
    }
    const STATE = ['start', 'stop', 'restart', 'enable', 'disable'], READ = ['status', 'is-active', 'is-enabled'];
    if (!STATE.includes(verb) && !READ.includes(verb)) {
      if (['reload', 'try-restart', 'reload-or-restart', 'mask', 'unmask', 'daemon-reload', 'show', 'cat', 'list-unit-files', 'list-timers', 'list-sockets', 'is-failed', 'reset-failed', 'kill', 'edit', 'reboot', 'poweroff', 'halt', 'suspend', 'isolate', 'get-default', 'set-default'].includes(verb)) { c.er('systemctl: Dieser Unterbefehl wird im Lab nicht simuliert.', 'SIM'); return 1; }
      c.er('Unknown command verb ' + verb + '.', 'Hinweis: Diesen Unterbefehl kennt systemctl nicht. Im Lab gibt es status, start, stop, restart, enable, disable, is-active, is-enabled und list-units.'); return 1;
    }
    if (!names.length) { if (verb === 'status') { c.er('systemctl: Der Systemstatus ohne Dienstnamen wird im Lab nicht simuliert. Nenne einen Dienst: systemctl status ssh.', 'SIM'); return 1; } c.er('Too few arguments.', 'USAGE'); return 1; }
    let code = 0;
    if (verb === 'status') {
      names.forEach((nm, i) => {
        const u = svcUnit(nm), s = svcFind(sys, nm);
        if (!s) { c.er('Unit ' + u + ' could not be found.', 'NOUNIT'); code = 4; return; }
        if (i > 0) c.ln('');
        c.ln((s.on ? '●' : s.failed ? '×' : '○') + ' ' + s.n + '.service - ' + s.d);
        c.ln('     Loaded: loaded (/lib/systemd/system/' + s.n + '.service; ' + (s.en ? 'enabled' : 'disabled') + '; vendor preset: enabled)');
        c.ln('     Active: ' + (s.on ? 'active (running)' : s.failed ? 'failed (Result: exit-code)' : 'inactive (dead)') + (s.since ? ' since ' + s.since : ''));
        if (s.on) c.ln('   Main PID: ' + s.pid + ' (' + s.exe + ')');
        if (!s.on) code = code || 3;
      });
      c.hint('Hinweis: Die echte Ausgabe von systemctl status ist länger (Docs, Speicher, Prozessbaum, letzte Logzeilen). Das Lab zeigt die wichtigsten Zeilen: Loaded (beim Start aktiviert?) und Active (läuft gerade?).'); return code;
    }
    if (verb === 'is-active') { names.forEach(nm => { const s = svcFind(sys, nm); if (!O.quiet) c.ln(s ? act(s) : 'inactive'); }); return names.some(nm => { const s = svcFind(sys, nm); return s && s.on; }) ? 0 : (names.every(nm => !svcFind(sys, nm)) ? 4 : 3); }
    if (verb === 'is-enabled') {
      names.forEach(nm => { const s = svcFind(sys, nm); if (!s) { c.er('Failed to get unit file state for ' + svcUnit(nm) + ': No such file or directory', 'NOUNIT'); code = 1; return; } if (!O.quiet) c.ln(s.en ? 'enabled' : 'disabled'); if (!s.en) code = 1; }); return code;
    }
    /* Zustandsänderungen: erst Einheit suchen, dann Berechtigung */
    const found = names.map(nm => ({ nm, u: svcUnit(nm), s: svcFind(sys, nm) })), enOnly = verb === 'enable' || verb === 'disable';
    for (const f of found) if (!f.s) { c.er((enOnly ? 'Failed to ' + verb + ' unit: Unit file ' + f.u + ' does not exist.' : 'Failed to ' + verb + ' ' + f.u + ': Unit ' + f.u + (verb === 'stop' ? ' not loaded.' : ' not found.')), 'NOUNIT'); code = enOnly ? 1 : 5; }
    if (code) return code;
    if (c.user !== 'root') { if (enOnly) c.er('Failed to ' + verb + ' unit: Interactive authentication required.', 'SVCAUTH'); else { c.er('Failed to ' + verb + ' ' + found[0].u + ': Interactive authentication required.', 'SVCAUTH'); c.er("See system logs and 'systemctl status " + found[0].u + "' for details."); } return 1; }
    for (const f of found) {
      const s = f.s;
      if (verb === 'stop') svcStop(sys, s);
      else if (verb === 'start' || verb === 'restart') {
        if (verb === 'restart') svcStop(sys, s);
        if (s.broken) { s.failed = true; s.since = SVC_AT; c.er('Job for ' + f.u + ' failed because the control process exited with error code.'); c.er('See "systemctl status ' + f.u + '" and "journalctl -xeu ' + f.u + '" for details.', 'Hinweis: Der Dienst startet nicht, weil seine Einrichtung einen Fehler hat. Die Ursache steht im Protokoll (journalctl wird im Lab nicht simuliert).'); code = 1; } else svcStart(sys, s);
      } else if (verb === 'enable') {
        if (s.sysv) { c.ln('Synchronizing state of ' + s.n + '.service with SysV service script with /lib/systemd/systemd-sysv-install.'); c.ln('Executing: /lib/systemd/systemd-sysv-install enable ' + s.n); }
        if (!s.en) { s.en = true; c.ln('Created symlink /etc/systemd/system/multi-user.target.wants/' + s.n + '.service → /lib/systemd/system/' + s.n + '.service.'); }
        if (O.now) svcStart(sys, s);
      } else {
        if (s.sysv) { c.ln('Synchronizing state of ' + s.n + '.service with SysV service script with /lib/systemd/systemd-sysv-install.'); c.ln('Executing: /lib/systemd/systemd-sysv-install disable ' + s.n); }
        if (s.en) { s.en = false; c.ln('Removed /etc/systemd/system/multi-user.target.wants/' + s.n + '.service.'); }
        if (O.now) svcStop(sys, s);
      }
    }
    return code;
  });

  ['tar', 'nano', 'vi', 'journalctl', 'ssh', 'scp', 'rsync', 'git', 'python3', 'wget', 'nc', 'ifconfig', 'netstat', 'zip', 'unzip', 'gzip', 'ln', 'diff', 'watch', 'lsof', 'dmesg', 'service', 'shutdown', 'reboot', 'mount'].forEach(n => { STUBS[n] = n === 'ifconfig' || n === 'netstat' ? 'Das alte Werkzeug ist auf neuen Systemen nicht mehr installiert. Moderner Ersatz: ' + (n === 'ifconfig' ? 'ip a' : 'ss -tuln') : 'Dieses Programm wird im Lab nicht simuliert.'; });

  /* Netzwerk */
  const maskOf = p => { const m = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; return [m >>> 24, (m >>> 16) & 255, (m >>> 8) & 255, m & 255].join('.'); };
  const ipN = s => { const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s); return m && m.slice(1).every(x => +x < 256) ? ((+m[1] << 24 | +m[2] << 16 | +m[3] << 8 | +m[4]) >>> 0) : null; };
  const nIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  def('ip', 'ip a   |   ip -br a   |   ip r', c => {
    const net = c.sys.net, a = c.args.slice(); const brief = a[0] === '-br' || a[0] === '-brief' || a[0] === '-c'; if (brief || a[0] === '-c') a.shift();
    const sub = a[0] || ''; if (!sub) { c.er('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }', 'USAGE'); return 1; }
    const bc = nIp(((ipN(net.ip) | (~(0xFFFFFFFF << (32 - net.prefix)) >>> 0)) >>> 0));
    if (['a', 'addr', 'address'].includes(sub) && (!a[1] || a[1] === 'show')) {
      if (brief) { c.ln('lo               UNKNOWN        127.0.0.1/8 ::1/128'); c.ln('eth0             UP             ' + net.ip + '/' + net.prefix + ' fe80::a00:27ff:fe4b:1d2a/64'); return 0; }
      c.ln('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000'); c.ln('    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00'); c.ln('    inet 127.0.0.1/8 scope host lo'); c.ln('       valid_lft forever preferred_lft forever'); c.ln('    inet6 ::1/128 scope host'); c.ln('       valid_lft forever preferred_lft forever');
      c.ln('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000'); c.ln('    link/ether 08:00:27:4b:1d:2a brd ff:ff:ff:ff:ff:ff'); c.ln('    inet ' + net.ip + '/' + net.prefix + ' brd ' + bc + ' scope global dynamic eth0'); c.ln('       valid_lft 85432sec preferred_lft 85432sec'); c.ln('    inet6 fe80::a00:27ff:fe4b:1d2a/64 scope link'); c.ln('       valid_lft forever preferred_lft forever'); return 0;
    }
    if (['r', 'route'].includes(sub)) { const nw = nIp((ipN(net.ip) & (0xFFFFFFFF << (32 - net.prefix))) >>> 0); c.ln('default via ' + net.gw + ' dev eth0 proto dhcp metric 100'); c.ln(nw + '/' + net.prefix + ' dev eth0 proto kernel scope link src ' + net.ip + ' metric 100'); return 0; }
    if (['l', 'link'].includes(sub)) { c.ln('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000'); c.ln('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000'); return 0; }
    c.er('Object "' + sub + '" is unknown, try "ip help".', 'USAGE'); return 1;
  });
  /* PRUEFEN P7: ping-Zeiten sind aus der Adresse berechnet (gleich bei jedem Aufruf). ping ohne -c sendet im Lab nur vier Pakete statt endlos. Passt das, oder soll... */
  def('ping', 'ping [-c ANZAHL] Ziel', c => {
    const o = opts(c, c.args, 'n', 'cW'); if (!o) return 2; if (!o.rest.length) { c.er('ping: usage error: Destination address required', 'USAGE'); return 2; }
    const cnt = o.v.c !== undefined ? parseInt(o.v.c, 10) : 4; if (!(cnt >= 1)) { c.er("ping: invalid argument: '" + o.v.c + "'", 'USAGE'); return 2; }
    const tgt = o.rest[0], net = c.sys.net; let ip = ipN(tgt) !== null ? tgt : net.hosts[tgt];
    if (!ip) { c.er('ping: ' + tgt + ': Name or service not known', 'Hinweis: Der Name lässt sich nicht in eine IP-Adresse auflösen (DNS). Tippfehler? Probiere die IP-Adresse direkt, dann weißt du, ob es an DNS liegt.'); return 2; }
    const up = net.up ? net.up.includes(ip) : !(net.down || []).includes(ip), local = ip.startsWith('127.') || ip === net.ip, sameNet = ipN(ip) !== null && ((ipN(ip) ^ ipN(net.ip)) >>> (32 - net.prefix)) === 0;
    c.ln('PING ' + tgt + ' (' + ip + ') 56(84) bytes of data.'); const h = hashStr(ip); const ts = [];
    if (up) { for (let i = 1; i <= cnt; i++) { const t = rd((local ? 0.03 : sameNet ? 0.3 : 12) + ((h >> i) % 40) / (local ? 1000 : sameNet ? 100 : 10), local ? 3 : 2); ts.push(t); c.ln('64 bytes from ' + ip + ': icmp_seq=' + i + ' ttl=' + (local ? 64 : sameNet ? 64 : 117) + ' time=' + t + ' ms'); }
      c.ln(''); c.ln('--- ' + tgt + ' ping statistics ---'); c.ln(cnt + ' packets transmitted, ' + cnt + ' received, 0% packet loss, time ' + (cnt - 1) * 1002 + 'ms'); const mn = Math.min(...ts), mx = Math.max(...ts), av = ts.reduce((x, y) => x + y, 0) / cnt; c.ln('rtt min/avg/max/mdev = ' + mn.toFixed(3) + '/' + av.toFixed(3) + '/' + mx.toFixed(3) + '/0.0' + (h % 90 + 10)); return 0; }
    for (let i = 1; i <= cnt; i++) c.ln('From ' + (sameNet ? net.ip : net.gw) + ' icmp_seq=' + i + ' Destination Host Unreachable');
    c.ln(''); c.ln('--- ' + tgt + ' ping statistics ---'); c.ln(cnt + ' packets transmitted, 0 received, +' + cnt + ' errors, 100% packet loss, time ' + (cnt - 1) * 1002 + 'ms'); return 1;
  });
  def('ss', 'ss [-t] [-u] [-l] [-n] [-p] [-a]', c => {
    const o = opts(c, c.args, 'tulnpaH4'); if (!o) return 2; const F = o.f, S = c.sys.sockets;
    let rows = S.filter(s => (F.t || F.u ? (F.t && s.netid === 'tcp') || (F.u && s.netid === 'udp') : true));
    if (!F.a) rows = rows.filter(s => F.l ? (s.state === 'LISTEN' || s.state === 'UNCONN') : (s.state === 'ESTAB'));
    c.ln('Netid State  Recv-Q Send-Q ' + pad('Local Address:Port', 22) + ' ' + pad('Peer Address:Port', 20) + (F.p ? ' Process' : ''));
    rows.forEach(s => c.ln(pad(s.netid, 5) + ' ' + pad(s.state, 6) + ' ' + pad(0, 6) + ' ' + pad(s.state === 'LISTEN' ? 128 : 0, 6) + ' ' + pad(s.local, 22) + ' ' + pad(s.peer, 20) + (F.p && c.user === 'root' && s.proc ? ' users:(("' + s.proc + '",pid=' + s.pid + ',fd=3))' : '')));
    if (F.p && c.user !== 'root') c.hint('Hinweis: Ohne Administratorrechte zeigt ss -p keine Prozessnamen. Mit sudo ss -p sind sie sichtbar.');
  });
  def('df', 'df [-h]', c => { c.ln('Filesystem      Size  Used Avail Use% Mounted on'); c.ln('/dev/sda1        20G  7.2G   12G  38% /'); c.ln('tmpfs           2.0G     0  2.0G   0% /dev/shm'); c.ln('/dev/sda15      105M  6.1M   99M   6% /boot/efi'); });
  def('free', 'free [-h]', c => { c.ln('               total        used        free      shared  buff/cache   available'); c.ln('Mem:           3.8Gi       980Mi       1.5Gi        12Mi       1.4Gi       2.6Gi'); c.ln('Swap:          2.0Gi          0B       2.0Gi'); });
  def('uptime', 'uptime', c => { c.ln(' 09:30:15 up 3 days,  4:12,  1 user,  load average: 0.52, 0.31, 0.20'); });
  def('du', 'du [-s] [-h] Pfad', c => {
    const o = opts(c, c.args, 'sh'); if (!o) return 2; const ps = o.rest.length ? o.rest : ['.']; let code = 0;
    ps.forEach(p => { const w = c.get(p); if (w.err) { c.er("du: cannot access '" + p + "': " + ETXT[w.err], w.err); code = 1; return; } const sz = n => { let s = n.t === 'd' ? 4096 : Math.ceil(enc(n.content) / 4096) * 4096; if (n.t === 'd') Object.keys(n.ch).forEach(k => { s += sz(n.ch[k]); }); return s; }; const t = sz(w.n); c.ln((o.f.h ? human(t) : String(Math.ceil(t / 1024))) + '\t' + p); }); return code;
  });
  def(['bash', 'sh'], 'bash Skript', c => {
    if (!c.args.length) { c.er('bash: Die interaktive Shell läuft schon (das ist dein Terminal).'); return 1; }
    const p = c.args[0], w = c.get(p);
    if (w.err) { c.er('bash: ' + p + ': ' + ETXT[w.err], w.err); return 127; }
    if (w.n.t === 'd') { c.er('bash: ' + p + ': ' + ETXT.EISDIR, 'EISDIR'); return 126; }
    if (!c.can(w.n, 4)) { c.er('bash: ' + p + ': ' + ETXT.EACCES, 'EACCES'); return 126; }
    if (w.n.sim != null) { if (w.n.sim) c.o(w.n.sim.endsWith(NL) ? w.n.sim : w.n.sim + NL); } else c.hint('Hinweis: Im Lab laufen Skripte nur, wenn sie eine Simulation hinterlegt haben. Lesen kannst du sie immer mit cat.');
    return 0;
  });
  def('crontab', 'crontab -l', c => {
    if (c.args[0] === '-l') { if (!c.sys.cron) { c.er('no crontab for ' + c.user); return 1; } c.o(c.sys.cron.endsWith('\n') ? c.sys.cron : c.sys.cron + '\n'); return 0; }
    if (c.args[0] === '-e') { c.er('crontab: Der Editor wird im Lab nicht simuliert.', 'SIM'); return 1; }
    c.er('crontab: usage error: ' + (c.args[0] ? 'unrecognized option' : 'file name or -l/-e required'), 'USAGE'); return 1;
  });

  /* ---------- Vervollständigung (Tab) ---------- */
  function complete(sys, line) {
    const m = /(^|[\s|;&]+)([^\s|;&]*)$/.exec(line); const word = m ? m[2] : '', head = line.slice(0, line.length - word.length);
    const before = head.trim(), isCmd = !before || /[|;&]$/.test(before) || /^sudo$/.test(before.split(/[|;&]/).pop().trim());
    let cands = [];
    if (isCmd && !word.includes('/')) cands = Object.keys(CMDS).filter(n => n.startsWith(word) && !CMDS[n].pkg || (CMDS[n].pkg && sys.pkgs.inst[CMDS[n].pkg] && n.startsWith(word))).sort();
    else {
      const sl = word.lastIndexOf('/'), dpart = sl >= 0 ? word.slice(0, sl + 1) : '', pre = word.slice(sl + 1);
      const w = walk(sys, norm(sys, dpart || '.'), sys.user);
      if (w.n && w.n.t === 'd' && can(sys, w.n, sys.user, 4)) cands = Object.keys(w.n.ch).filter(k => k.startsWith(pre) && (pre.startsWith('.') || k[0] !== '.')).sort().map(k => dpart + k + (w.n.ch[k].t === 'd' ? '/' : ''));
    }
    if (!cands.length) return { line, options: [] };
    let cp = cands[0]; cands.forEach(x => { while (!x.startsWith(cp)) cp = cp.slice(0, -1); });
    if (cands.length === 1) return { line: head + cands[0] + (cands[0].endsWith('/') ? '' : ' '), options: [] };
    return { line: head + cp, options: cands.map(x => x.replace(/^.*\/(?=.)/, '')) };
  }

  /* ---------- Hauptfunktion ---------- */
  /* run(sys, zeile) -> { items:[{k:'o'|'e'|'n', s}], stdout, stderr, text, hints, code, clear, prompt }  (wirft nie) */
  function run(sys, line) {
    const R = { items: [], hints: [], stdout: '', stderr: '', code: 0, clear: false, line: String(line == null ? '' : line) };
    const pr = prompt(sys); R.prompt = pr;
    try {
      if (sys.notices.length) { sys.notices.forEach(n => R.items.push({ k: 'n', s: n + '\n' })); sys.notices = []; }
      if (R.line.trim()) { sys.hist.push(R.line); R.code = runLine(sys, R.line, R, sys.user); sys.lastCode = R.code; }
    } catch (ex) { R.items.push({ k: 'e', s: 'bash: interner Fehler im Lab: ' + (ex && ex.message) }); R.code = 1; }
    R.items = R.items.map(x => (x.k !== 'e' || x.s.endsWith('\n')) ? x : Object.assign({}, x, { s: x.s + '\n' }));
    R.items.forEach(x => { if (x.k === 'o') R.stdout += x.s; else if (x.k === 'e') R.stderr += x.s; });
    R.text = R.items.map(x => x.s).join('');
    sys.rec.cmds.push(R.line); sys.rec.outs.push(R.stdout); sys.rec.items.push({ cmd: R.line, out: R.stdout, err: R.stderr, code: R.code });
    return R;
  }
  /* Mehrere Zeilen nacheinander ausführen (für Musterlösungen und Beispiele) */
  function runAll(sys, lines) { return lines.map(l => run(sys, l)); }

  /* ---------- Cron ---------- */
  const CRON_F = [{ n: 'Minute', lo: 0, hi: 59 }, { n: 'Stunde', lo: 0, hi: 23 }, { n: 'Tag des Monats', lo: 1, hi: 31 }, { n: 'Monat', lo: 1, hi: 12 }, { n: 'Wochentag', lo: 0, hi: 7 }];
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }, DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const CRON_AT = { '@hourly': '0 * * * *', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@weekly': '0 0 * * 0', '@monthly': '0 0 1 * *', '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *' };
  function cronParse(expr) {
    let s = String(expr == null ? '' : expr).trim().replace(/\s+/g, ' ');
    if (s === '@reboot') return { ok: false, reboot: true, err: '@reboot läuft einmal beim Systemstart, nicht nach Uhrzeit.' };
    if (CRON_AT[s]) s = CRON_AT[s];
    const f = s.split(' '); if (f.length !== 5) return { ok: false, err: 'Eine Cron-Zeit hat genau 5 Felder (Minute Stunde Tag Monat Wochentag), hier sind es ' + (s ? f.length : 0) + '.' };
    const sets = [], raw = f;
    for (let i = 0; i < 5; i++) {
      const F = CRON_F[i], set = new Set(); let star = false;
      for (const part of f[i].split(',')) {
        const m = /^(\*|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)(?:\/(\d+))?$/.exec(part); if (!m) return { ok: false, err: 'Das Feld ' + F.n + ' ("' + f[i] + '") ist ungültig.' };
        const val = v => { v = v.toLowerCase(); if (i === 3 && MON[v] != null) return MON[v]; if (i === 4 && DOW[v] != null) return DOW[v]; return /^\d+$/.test(v) ? +v : NaN; };
        let a, b; if (m[1] === '*') { a = F.lo; b = i === 4 ? 6 : F.hi; star = !m[2] || star; } else if (m[1].includes('-')) { const [x, y] = m[1].split('-'); a = val(x); b = val(y); } else { a = val(m[1]); b = m[2] ? F.hi : a; }
        if (!fin(a) || !fin(b)) return { ok: false, err: 'Das Feld ' + F.n + ' ("' + f[i] + '") ist ungültig.' };
        if (a < F.lo || b > F.hi || a > b) return { ok: false, err: 'Das Feld ' + F.n + ' erlaubt Werte von ' + F.lo + ' bis ' + F.hi + ', "' + f[i] + '" passt nicht.' };
        const st = m[2] ? +m[2] : 1; if (st < 1) return { ok: false, err: 'Der Schritt im Feld ' + F.n + ' muss mindestens 1 sein.' };
        for (let v = a; v <= b; v += st) set.add(i === 4 && v === 7 ? 0 : v);
      }
      sets.push({ set, star: f[i] === '*' });
    }
    return { ok: true, sets, raw: f, expr: f.join(' ') };
  }
  /* Zeitpunkt passt: Tag und Wochentag sind bei Einschränkung beider ODER-verknüpft (wie Vixie-Cron) */
  /* PRUEFEN P10: Cron: Sind Tag des Monats und Wochentag beide eingeschränkt, läuft der Job bei EINER passenden Angabe (ODER, wie Vixie-Cron). 7 und 0 gelten als So... */
  function cronDayOk(p, y, mo, d) {
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); if (!p.sets[3].set.has(mo)) return false;
    const dm = p.sets[2].set.has(d), dw = p.sets[4].set.has(dow), sd = p.sets[2].star, sw = p.sets[4].star;
    return sd && sw ? true : sd ? dw : sw ? dm : (dm || dw);
  }
  /* nächste n Zeitpunkte ab (y, mo, d, h, mi) exklusiv; liefert Texte "Mo 2026-11-09 02:30" */
  function cronNext(expr, from, n) {
    const p = cronParse(expr); if (!p.ok) return []; const out = [], WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    from = from || { y: 2026, mo: 11, d: 8, h: 9, mi: 30 }; const t0 = Date.UTC(from.y, from.mo - 1, from.d, from.h, from.mi) + 60000;
    let day = new Date(t0), first = true; day = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const minNext = new Date(t0);
    for (let i = 0; i < 366 * 6 && out.length < n; i++, first = false) {
      const y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, d = day.getUTCDate();
      if (cronDayOk(p, y, mo, d)) for (let h = 0; h < 24 && out.length < n; h++) { if (!p.sets[1].set.has(h)) continue; for (let mi = 0; mi < 60 && out.length < n; mi++) { if (!p.sets[0].set.has(mi)) continue; if (first && Date.UTC(y, mo - 1, d, h, mi) < minNext.getTime()) continue; out.push(WD[day.getUTCDay()] + ' ' + y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') + ' ' + String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0')); } }
      day = new Date(day.getTime() + 86400000);
    }
    return out;
  }
  /* Läufe an einem normalen Tag, der Tag und Wochentag erlaubt (Minuten x Stunden) */
  function cronPerDay(expr) { const p = cronParse(expr); return p.ok ? p.sets[0].set.size * p.sets[1].set.size : NAN; }
  const WDN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], MN = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function cronExplain(expr) {
    const s = String(expr || '').trim().replace(/\s+/g, ' '); if (s === '@reboot') return 'Einmal bei jedem Systemstart.';
    const p = cronParse(expr); if (!p.ok) return p.err; const f = p.raw, lst = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
    const sorted = i => [...p.sets[i].set].sort((a, b) => a - b), two = v => String(v).padStart(2, '0');
    let when; const mi = sorted(0), hr = sorted(1);
    if (mi.length === 1 && hr.length === 1) when = 'um ' + two(hr[0]) + ':' + two(mi[0]) + ' Uhr';
    else {
      let mp = f[0] === '*' ? 'jede Minute' : /^\*\/\d+$/.test(f[0]) ? 'alle ' + f[0].slice(2) + ' Minuten' : mi.length === 1 ? 'in Minute ' + mi[0] : 'in den Minuten ' + lst(mi);
      let hp = f[1] === '*' ? 'jede Stunde' : /^\*\/\d+$/.test(f[1]) ? 'alle ' + f[1].slice(2) + ' Stunden' : /^\d+-\d+$/.test(f[1]) ? 'zwischen ' + f[1].split('-')[0] + ' und ' + f[1].split('-')[1] + ' Uhr' : hr.length === 1 ? 'um ' + hr[0] + ' Uhr' : 'um ' + lst(hr) + ' Uhr';
      when = mp + ', ' + hp; if (f[0] !== '*' && /^\*\/\d+$/.test(f[1])) when = mp + ' jeder ' + f[1].slice(2) + '. Stunde'; if (f[0] !== '*' && f[1] === '*') when = mp + ' jeder Stunde';
    }
    const dayP = [];
    if (f[2] !== '*') dayP.push('am ' + lst(sorted(2)) + '. des Monats');
    if (f[4] !== '*') { const w = sorted(4); dayP.push(/^[1-5]-?[1-5]?$/.test(f[4]) && w.join() === '1,2,3,4,5' ? 'von Montag bis Freitag' : (f[2] !== '*' ? 'oder ' : '') + 'jeweils ' + lst(w.map(x => WDN[x]))); }
    if (f[3] !== '*') dayP.push('im ' + lst(sorted(3).map(x => MN[x])));
    return 'Läuft ' + when + (dayP.length ? ', ' + dayP.join(', ') : ', an jedem Tag') + '.';
  }

  const API = { parseDe, fmtN, rd, hashStr, rng, ri, pick, shuffle,
    newSystem, put, run, runAll, complete, prompt, norm, walk, getNode, readText, modeOf, listDir, exists, syncAccounts, tokenize, parse,
    modeSym, modeOct, symToMode, applyChmod, maskOf, ipN, nIp, can, textLines, human,
    cronParse, cronExplain, cronNext, cronPerDay, CMDS, USAGE, HINT, mkNode, NOW };
  root.LIN_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
