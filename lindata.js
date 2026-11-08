'use strict';
/* Tonfunk Linux-Terminal-Lab: Daten (virtuelles Dateisystem, Aufgaben-Generatoren, Beispiele). Kennung 'lin'.
   REIN SIMULIERT: Alles passiert im Speicher, nichts auf dem echten Rechner.
   window.LIN_DATA  { cats, tasks, gens, make, makeTask, randomQ, examples, image, facts, runSolution }
   window.LIN_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.lin.done' = {id:true})
   Zwei Arten von Aufgaben:
   - Terminal-Aufgaben (kind 'term'): Der Lernende arbeitet im simulierten Terminal. Geprüft wird der ZUSTAND des virtuellen
     Dateisystems (oder die Ausgabe) mit check(sys) -> true oder ein Text, was noch fehlt. Jede hat eine Musterlösung (solution)
     und falsche Wege (wrong), die der Test gegen check() prüft.
   - Auswahl- und Zahlenaufgaben: entstehen aus einem Generator mit festem Seed (id), wie in den anderen Labs.
   Verdeckte-Fehler-Prinzip: Titel und Texte verraten weder das Ergebnis noch den Fehler (neutrale Titel). */
(function (root) {
  const C = () => root.LIN_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 0 : d, true);
  const CATS = ['Dateisystem und Pfade', 'Dateirechte', 'Textwerkzeuge und Pipes', 'Prozesse', 'Benutzer, sudo und Pakete', 'Netzwerk und Logdateien', 'Shell-Skripte und Cron'];
  const NL = String.fromCharCode(10);

  /* ============================================================ Das virtuelle System (Abbild "std") */
  const A = 'azubi';
  const README = '# Messdaten-Projekt' + NL + 'Dieses Projekt wertet Sensordaten aus.' + NL + 'Start: ./backup.sh sichert den Ordner.' + NL;
  const CSV = 'id,sensor,wert' + NL + '1,temp,21.5' + NL + '2,druck,1013' + NL + '3,temp,22.1' + NL + '4,feuchte,45' + NL + '5,temp,21.9' + NL + '6,druck,1011' + NL;
  const SERVERLOG = [
    '2026-11-08 08:01:12 INFO Dienst gestartet', '2026-11-08 08:01:15 INFO Verbindung zur Datenbank hergestellt', '2026-11-08 08:14:03 WARN Speicher bei 85 Prozent',
    '2026-11-08 08:20:41 ERROR Zeitüberschreitung bei Sensor 3', '2026-11-08 08:22:10 INFO Sensor 3 wieder erreichbar', '2026-11-08 09:02:55 error Datei messwerte.csv nicht lesbar',
    '2026-11-08 09:10:09 INFO Neustart angefordert', '2026-11-08 09:10:30 ERROR Datenbank antwortet nicht'].join(NL) + NL;
  const BACKUP = ['#!/bin/bash', '# Sichert den Projektordner', 'QUELLE="$HOME/Projekt"', 'ZIEL="/tmp/backup"', 'mkdir -p "$ZIEL"', 'cp -r "$QUELLE" "$ZIEL"', 'echo "Backup fertig: $(date +%F)"'].join(NL) + NL;
  const ZAEHLE = ['#!/bin/bash', 'for datei in *.csv; do', '  zeilen=$(wc -l < "$datei")', '  echo "$datei hat $zeilen Zeilen"', 'done'].join(NL) + NL;
  /* Webserver-Log: [IP, Methode, Pfad, Status, Bytes] */
  /* PRUEFEN P13: Webserver-Log im Common Log Format, IP-Adressen aus den Dokumentationsbereichen (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), Übungsne... */
  const ACC = [['192.168.10.50', 'GET', '/index.html', 200, 5120], ['203.0.113.7', 'GET', '/admin.php', 404, 162], ['203.0.113.7', 'GET', '/wp-login.php', 404, 162], ['198.51.100.23', 'GET', '/index.html', 200, 5120],
    ['203.0.113.7', 'GET', '/admin.php', 404, 162], ['192.168.10.50', 'GET', '/styles.css', 200, 1840], ['203.0.113.7', 'POST', '/login', 401, 98], ['198.51.100.23', 'GET', '/produkte.html', 200, 8211],
    ['203.0.113.7', 'GET', '/admin.php', 404, 162], ['192.0.2.44', 'GET', '/index.html', 200, 5120], ['198.51.100.23', 'GET', '/kontakt.html', 200, 3002], ['203.0.113.7', 'GET', '/.env', 404, 162],
    ['192.168.10.50', 'GET', '/bilder/logo.png', 200, 20480], ['203.0.113.7', 'GET', '/wp-login.php', 404, 162], ['198.51.100.23', 'GET', '/impressum.html', 404, 162], ['192.0.2.44', 'GET', '/produkte.html', 200, 8211],
    ['203.0.113.7', 'GET', '/index.html', 200, 5120], ['198.51.100.99', 'GET', '/index.html', 200, 5120], ['203.0.113.7', 'GET', '/admin.php', 404, 162], ['192.168.10.50', 'GET', '/produkte.html', 200, 8211],
    ['198.51.100.23', 'GET', '/index.html', 304, 0], ['203.0.113.7', 'GET', '/phpmyadmin/', 404, 162], ['192.168.10.50', 'GET', '/api/status', 500, 311], ['192.0.2.44', 'GET', '/styles.css', 200, 1840],
    ['198.51.100.23', 'GET', '/impressum.html', 404, 162], ['203.0.113.7', 'GET', '/index.html', 200, 5120]];
  const ACCESS = ACC.map((r, i) => { const t = 8 * 60 + i * 7; return r[0] + ' - - [08/Nov/2026:' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') + ':' + String((i * 13) % 60).padStart(2, '0') + ' +0100] "' + r[1] + ' ' + r[2] + ' HTTP/1.1" ' + r[3] + ' ' + r[4]; }).join(NL) + NL;
  /* Anmeldeprotokoll */
  const AUTH_ROWS = [
    ['06:31:02', 'sshd[2201]: Failed password for invalid user admin from 203.0.113.7 port 40122 ssh2'], ['06:31:09', 'sshd[2201]: Failed password for invalid user root from 203.0.113.7 port 40124 ssh2'],
    ['06:31:17', 'sshd[2203]: Failed password for invalid user test from 203.0.113.7 port 40130 ssh2'], ['06:31:25', 'sshd[2203]: Connection closed by invalid user test 203.0.113.7 port 40130 [preauth]'],
    ['07:12:44', 'sshd[2250]: Accepted password for azubi from 192.168.10.50 port 50321 ssh2'], ['07:12:44', 'sshd[2250]: pam_unix(sshd:session): session opened for user azubi(uid=1000) by (uid=0)'],
    ['07:40:01', 'CRON[2301]: pam_unix(cron:session): session opened for user root(uid=0) by (uid=0)'], ['07:40:01', 'CRON[2301]: pam_unix(cron:session): session closed for user root'],
    ['08:02:15', 'sudo:   azubi : TTY=pts/0 ; PWD=/home/azubi ; USER=root ; COMMAND=/usr/bin/apt update'], ['08:02:15', 'sudo: pam_unix(sudo:session): session opened for user root(uid=0) by azubi(uid=1000)'],
    ['08:02:19', 'sudo: pam_unix(sudo:session): session closed for user root'], ['08:15:30', 'sshd[2388]: Failed password for azubi from 192.168.10.50 port 50410 ssh2'],
    ['08:15:36', 'sshd[2388]: Accepted password for azubi from 192.168.10.50 port 50410 ssh2'], ['08:44:50', 'sshd[2410]: Failed password for invalid user oracle from 203.0.113.7 port 41002 ssh2'],
    ['08:44:58', 'sshd[2410]: Failed password for invalid user admin from 203.0.113.7 port 41004 ssh2'], ['08:45:03', 'sshd[2410]: Failed password for invalid user ubuntu from 203.0.113.7 port 41006 ssh2'],
    ['08:45:07', 'sshd[2410]: Connection closed by invalid user ubuntu 203.0.113.7 port 41006 [preauth]'], ['09:05:11', 'sudo:   anna : TTY=pts/2 ; PWD=/home/anna ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx'],
    ['09:05:11', 'sudo: pam_unix(sudo:session): session opened for user root(uid=0) by anna(uid=1001)'], ['09:05:12', 'sudo: pam_unix(sudo:session): session closed for user root'],
    ['09:20:40', 'sshd[2455]: Accepted publickey for anna from 192.168.10.51 port 52210 ssh2'], ['09:28:02', 'sudo:   azubi : TTY=pts/0 ; PWD=/home/azubi ; USER=root ; COMMAND=/usr/bin/tail /var/log/auth.log']];
  const AUTH = AUTH_ROWS.map(r => 'Nov  8 ' + r[0] + ' tonfunk-pc ' + r[1]).join(NL) + NL;
  const SYSLOG = ['Nov  8 07:00:01 tonfunk-pc systemd[1]: Started Daily apt download activities.', 'Nov  8 07:40:01 tonfunk-pc CRON[2300]: (root) CMD (/usr/local/bin/sichern.sh)', 'Nov  8 08:00:12 tonfunk-pc kernel: [ 3601.221] eth0: link up, 1000 Mbps, full-duplex',
    'Nov  8 08:00:14 tonfunk-pc NetworkManager[601]: <info> DHCP lease renewed: 192.168.10.25', 'Nov  8 08:30:00 tonfunk-pc systemd[1]: nginx.service: Succeeded.', 'Nov  8 08:30:01 tonfunk-pc systemd[1]: Started A high performance web server.',
    'Nov  8 09:10:44 tonfunk-pc kernel: [ 7200.114] usb 1-2: new high-speed USB device number 4'].join(NL) + NL;

  /* PRUEFEN P12: Abbild: Konten wie Ubuntu (azubi UID 1000, Gruppe sudo 27, adm 4, www-data 33), Gruppe dev mit frei gewählter Nummer 1010. Logrechte: auth.log und ... */
  function stdSpec() {
    const E = [], R = { o: 'root', g: 'root' };
    const F = (p, c, o) => E.push(Object.assign({ p, t: 'f', m: 0o644, o: A, g: A, c }, o));
    const Dd = (p, o) => E.push(Object.assign({ p, t: 'd', m: 0o755, o: A, g: A }, o));
    ['/bin', '/boot', '/dev', '/etc', '/etc/ssh', '/home', '/opt', '/srv', '/srv/web', '/usr', '/usr/bin', '/usr/local', '/var', '/var/log', '/var/log/nginx', '/var/spool'].forEach(p => Dd(p, R));
    Dd('/tmp', { m: 0o1777, o: 'root', g: 'root' }); Dd('/root', { m: 0o700, o: 'root', g: 'root' }); F('/root/geheim.txt', 'nur für root' + NL, { m: 0o600, o: 'root', g: 'root' });
    Dd('/home/azubi'); Dd('/home/anna', { o: 'anna', g: 'anna' });
    F('/home/azubi/.bashrc', '# ~/.bashrc: wird bei jeder neuen Shell gelesen' + NL + "alias ll='ls -alF'" + NL, {}); F('/home/azubi/.profile', '# ~/.profile' + NL, {});
    F('/home/azubi/notizen.txt', 'Einkaufsliste:' + NL + 'Kabel' + NL + 'Lötzinn' + NL + 'Multimeter' + NL, {});
    Dd('/home/azubi/Dokumente'); F('/home/azubi/Dokumente/bericht.txt', 'Praktikumsbericht Woche 3' + NL + 'Thema: Messungen am Netzteil' + NL, {}); F('/home/azubi/Dokumente/protokoll.txt', 'Protokoll der Besprechung' + NL, {});
    Dd('/home/azubi/Downloads'); F('/home/azubi/Downloads/anleitung.txt', 'Aufbauanleitung Schritt 1 bis 5' + NL, {}); F('/home/azubi/Downloads/ideen.txt', 'Ideen für das Abschlussprojekt' + NL, {});
    F('/home/azubi/Downloads/foto.png', 'PNG-Bilddaten', {}); F('/home/azubi/Downloads/datenblatt.pdf', 'PDF-Daten', {});
    Dd('/home/azubi/Projekt'); F('/home/azubi/Projekt/README.md', README, {}); F('/home/azubi/Projekt/daten.csv', CSV, {}); F('/home/azubi/Projekt/server.log', SERVERLOG, {});
    /* PRUEFEN P19: Shell-Skripte werden im Lab nur gelesen. Gestartet zeigen sie eine hinterlegte Ausgabe (keine echte Ausführung). Der Auftrag lautet "einfache Shell... */
    F('/home/azubi/Projekt/backup.sh', BACKUP, { sim: 'Backup fertig: 2026-11-08' }); F('/home/azubi/Projekt/zaehle.sh', ZAEHLE, { m: 0o755, sim: 'daten.csv hat 7 Zeilen' }); F('/home/azubi/Projekt/tmp.bak', 'alte Sicherung', {});
    Dd('/home/azubi/Projekt/alt'); F('/home/azubi/Projekt/alt/old1.c', 'int main(){return 0;}' + NL, {}); F('/home/azubi/Projekt/alt/old2.c', '/* veraltet */' + NL, {}); F('/home/azubi/Projekt/alt/notes.txt', 'nicht mehr gebraucht' + NL, {});
    Dd('/home/azubi/Projekt/src'); F('/home/azubi/Projekt/src/main.c', '#include <stdio.h>' + NL + 'int main(void) { printf("Hallo"); return 0; }' + NL, {}); F('/home/azubi/Projekt/src/util.c', '/* Hilfsfunktionen */' + NL, {}); F('/home/azubi/Projekt/src/util.h', '/* Kopf */' + NL, {});
    Dd('/home/azubi/Projekt/docs'); F('/home/azubi/Projekt/docs/handbuch.md', '# Handbuch' + NL, {}); F('/home/azubi/Projekt/docs/plan.txt', 'Plan für Dezember' + NL, {});
    F('/home/anna/aufgaben.txt', 'Server prüfen' + NL, { o: 'anna', g: 'anna' });
    F('/srv/web/index.html', '<html><body>Hallo Tonfunk</body></html>' + NL, { m: 0o600, o: 'root', g: 'root' });
    F('/etc/hosts', '127.0.0.1 localhost' + NL + '127.0.1.1 tonfunk-pc' + NL + '192.168.10.10 fileserver' + NL, R); F('/etc/hostname', 'tonfunk-pc' + NL, R);
    F('/etc/resolv.conf', 'nameserver 192.168.10.1' + NL + 'search tonfunk.local' + NL, R); F('/etc/os-release', 'PRETTY_NAME="Ubuntu 22.04.3 LTS"' + NL + 'NAME="Ubuntu"' + NL + 'VERSION_ID="22.04"' + NL, R);
    F('/etc/shadow', 'root:*:19700:0:99999:7:::' + NL + 'azubi:*:19700:0:99999:7:::' + NL, { m: 0o640, o: 'root', g: 'shadow' });
    F('/etc/crontab', '# /etc/crontab: Systemweite Cron-Jobs (mit Benutzerfeld)' + NL + '# m h dom mon dow user command' + NL + '17 * * * * root cd / && run-parts --report /etc/cron.hourly' + NL + '25 6 * * * root test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily' + NL, R);
    F('/var/log/syslog', SYSLOG, { m: 0o640, o: 'syslog', g: 'adm' }); F('/var/log/auth.log', AUTH, { m: 0o640, o: 'root', g: 'adm' });
    F('/var/log/dpkg.log', '2026-11-05 10:02:11 install nginx:amd64 <none> 1.18.0-6ubuntu14' + NL + '2026-11-05 10:02:14 status installed nginx:amd64 1.18.0-6ubuntu14' + NL, R);
    F('/var/log/nginx/access.log', ACCESS, { m: 0o644, o: 'root', g: 'adm' }); F('/var/log/nginx/error.log', '2026/11/08 08:20:41 [error] 745#745: *3 open() "/srv/web/admin.php" failed (2: No such file or directory)' + NL, { m: 0o640, o: 'www-data', g: 'adm' });
    return {
      cwd: '/home/azubi', user: 'azubi', host: 'tonfunk-pc',
      users: [{ n: 'root', uid: 0, home: '/root', groups: ['root'], gecos: 'root' }, { n: 'daemon', uid: 1, home: '/usr/sbin', groups: ['daemon'], shell: '/usr/sbin/nologin' }, { n: 'www-data', uid: 33, home: '/var/www', groups: ['www-data'], shell: '/usr/sbin/nologin' },
        { n: 'syslog', uid: 102, home: '/home/syslog', groups: ['syslog', 'adm'], shell: '/usr/sbin/nologin' }, { n: 'sshd', uid: 106, home: '/run/sshd', groups: ['sshd'], shell: '/usr/sbin/nologin' },
        { n: 'azubi', uid: 1000, home: '/home/azubi', groups: ['azubi', 'sudo'], gecos: 'Azubi' }, { n: 'anna', uid: 1001, home: '/home/anna', groups: ['anna', 'dev'], gecos: 'Anna Beispiel' }],
      groups: { root: 0, daemon: 1, adm: 4, sudo: 27, 'www-data': 33, shadow: 42, syslog: 102, sshd: 106, azubi: 1000, anna: 1001, dev: 1010 },
      files: E,
      procs: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.3, vsz: 168936, rss: 11932, stat: 'Ss', time: '0:03', cmd: '/sbin/init' }, { pid: 412, user: 'syslog', mem: 0.1, vsz: 222404, rss: 4800, stat: 'Ssl', cmd: '/usr/sbin/rsyslogd -n -iNONE' },
        { pid: 531, user: 'root', stat: 'Ss', cmd: '/usr/sbin/cron -f' }, { pid: 601, user: 'root', cpu: 0.1, vsz: 25000, rss: 8100, cmd: '/lib/systemd/systemd-resolved' }, { pid: 688, user: 'root', mem: 0.2, vsz: 15420, rss: 6400, cmd: 'sshd: /usr/sbin/sshd -D' },
        { pid: 745, user: 'root', cpu: 0.1, mem: 0.1, vsz: 55200, rss: 5300, time: '0:01', cmd: 'nginx: master process /usr/sbin/nginx' }, { pid: 746, ppid: 745, user: 'www-data', cpu: 0.2, mem: 0.1, vsz: 55880, rss: 5900, cmd: 'nginx: worker process' },
        { pid: 1201, ppid: 1190, user: 'azubi', mem: 0.2, vsz: 10100, rss: 5200, tty: 'pts/0', stat: 'Ss', start: '09:00', cmd: 'bash' }, { pid: 1350, ppid: 1340, user: 'anna', mem: 0.2, vsz: 10100, rss: 5100, tty: 'pts/2', stat: 'Ss+', start: '08:40', cmd: 'bash' },
        { pid: 2417, ppid: 1201, user: 'azubi', cpu: 97.3, mem: 4.2, vsz: 280400, rss: 165000, tty: 'pts/1', stat: 'R', start: '08:55', time: '41:12', cmd: 'python3 /opt/messung/auswertung.py' },
        { pid: 2655, ppid: 1, user: 'azubi', cpu: 0.4, mem: 0.6, vsz: 90100, rss: 24100, stat: 'S', start: '08:20', time: '0:09', cmd: 'backup-sync --daemon', stubborn: true }],
      pkgs: { inst: { bash: '5.1-6ubuntu1', coreutils: '8.32-4.1ubuntu1', cron: '3.0pl1-137ubuntu3', nginx: '1.18.0-6ubuntu14', 'openssh-server': '1:8.9p1-3ubuntu0.4' },
        avail: { bash: { v: '5.1-6ubuntu1', d: 'GNU Bourne Again SHell', base: true }, coreutils: { v: '8.32-4.1ubuntu1', d: 'GNU core utilities', base: true }, cron: { v: '3.0pl1-137ubuntu3', d: 'process scheduling daemon', base: true }, nginx: { v: '1.18.0-6ubuntu14', d: 'small, powerful, scalable web/proxy server' }, 'openssh-server': { v: '1:8.9p1-3ubuntu0.4', d: 'secure shell (SSH) server', base: true },
          tree: { v: '2.0.2-1', d: 'displays directory tree, in color' }, htop: { v: '3.2.2-1', d: 'interactive processes viewer' }, curl: { v: '7.81.0-1ubuntu1.15', d: 'command line tool for transferring data with URL syntax' }, nmap: { v: '7.80+dfsg1-2build1', d: 'The Network Mapper' }, vim: { v: '2:8.2.3995-1ubuntu2', d: 'Vi IMproved - enhanced vi editor' }, cowsay: { v: '3.03+dfsg2-8', d: 'configurable talking cow' } } },
      net: { ip: '192.168.10.25', prefix: 24, gw: '192.168.10.1', hosts: { localhost: '127.0.0.1', fileserver: '192.168.10.10', router: '192.168.10.1', 'example.com': '93.184.216.34', 'dns.google': '8.8.8.8' }, up: ['127.0.0.1', '192.168.10.1', '192.168.10.10', '192.168.10.25', '192.168.10.50', '8.8.8.8', '93.184.216.34'] },
      sockets: [{ netid: 'udp', state: 'UNCONN', local: '127.0.0.53%lo:53', peer: '0.0.0.0:*', proc: 'systemd-resolve', pid: 601 }, { netid: 'tcp', state: 'LISTEN', local: '0.0.0.0:22', peer: '0.0.0.0:*', proc: 'sshd', pid: 688 }, { netid: 'tcp', state: 'LISTEN', local: '0.0.0.0:80', peer: '0.0.0.0:*', proc: 'nginx', pid: 745 },
        { netid: 'tcp', state: 'LISTEN', local: '127.0.0.1:631', peer: '0.0.0.0:*', proc: 'cupsd', pid: 899 }, { netid: 'tcp', state: 'ESTAB', local: '192.168.10.25:22', peer: '192.168.10.50:51234', proc: 'sshd', pid: 2250 }],
      cron: '# m h  dom mon dow   command' + NL + '*/15 * * * * /home/azubi/Projekt/backup.sh' + NL + '0 2 * * 1 /usr/bin/apt update' + NL
    };
  }
  /* neues System aus dem Abbild; over: {cwd, user, setup(sys)} */
  function image(over) { over = over || {}; const sp = stdSpec(); if (over.cwd) sp.cwd = over.cwd; if (over.user) sp.user = over.user; const sys = C().newSystem(sp); if (over.setup) over.setup(sys); return sys; }

  /* ---------- Fakten, aus den Daten selbst gerechnet (Soll-Werte der Prüfungen) ---------- */
  const cnt = (arr, fn) => { const m = {}; arr.forEach(x => { const k = fn(x); m[k] = (m[k] || 0) + 1; }); return m; };
  const topOf = m => Object.keys(m).sort((a, b) => m[b] - m[a])[0];
  const ipCnt = cnt(ACC, r => r[0]), p404 = cnt(ACC.filter(r => r[3] === 404), r => r[1] + ' ' + r[2] + ' HTTP/1.1');
  const FACTS = { topIp: topOf(ipCnt), topIpCount: ipCnt[topOf(ipCnt)], top404: topOf(p404), top404Count: p404[topOf(p404)], failed: AUTH_ROWS.filter(r => r[1].includes('Failed password')).length, authTail5: AUTH_ROWS.slice(-5).map(r => 'Nov  8 ' + r[0] + ' tonfunk-pc ' + r[1]).join(NL) + NL,
    errLines: SERVERLOG.split(NL).filter(l => /error/i.test(l)).join(NL) + NL, head3: CSV.split(NL).slice(0, 3).join(NL) + NL };

  /* ============================================================ Terminal-Aufgaben */
  const items = sys => sys.rec.items;
  const used = (sys, re) => items(sys).some(x => re.test(x.cmd.trim()));
  const firstLine = s => (s.split(NL).find(l => l.trim()) || '').trim();
  const pipes = s => (s.match(/\|/g) || []).length;
  const TERM = [
    { n: 2, kind: 'term', cat: 0, level: 1, title: 'Nachbarordner erreichen', cwd: '/home/azubi/Projekt/src',
      text: 'Du stehst im Ordner src deines Projekts. Wechsle mit einem relativen Pfad (ohne führenden Schrägstrich) in den Ordner docs, der direkt neben src liegt.',
      check: sys => sys.cwd !== '/home/azubi/Projekt/docs' ? 'Du stehst noch nicht im Ordner docs (pwd zeigt dir, wo du bist).' : (used(sys, /^cd\s+(?![\/~-])\S/) ? true : 'Du bist im richtigen Ordner, aber nicht mit einem relativen Pfad (er beginnt hier nicht mit / oder ~).'),
      solution: ['cd ../docs'], wrong: [['cd /home/azubi/Projekt/docs'], ['cd docs']], tips: ['Mit pwd siehst du, wo du bist, mit ls, was im Ordner liegt.', 'Zwei Punkte .. stehen für den übergeordneten Ordner. Von dort gehst du in docs.'],
      expl: 'Der Ordner docs liegt neben src, also im selben Elternordner. Erst mit .. eine Ebene hoch, dann docs: cd ../docs. Ein absoluter Pfad (cd /home/azubi/Projekt/docs) führt auch hin, ist aber nicht relativ.' },
    { n: 4, kind: 'term', cat: 0, level: 2, title: 'Ablagestruktur anlegen',
      text: 'Lege in deinem Home-Verzeichnis die Ordnerstruktur Archiv/2026/Q4 an (die Ordner Archiv und 2026 gibt es noch nicht) und erzeuge im Ordner Q4 eine leere Datei liste.txt.',
      check: sys => { const c = C(); if (!c.exists(sys, '/home/azubi/Archiv/2026/Q4')) return 'Der Ordner Archiv/2026/Q4 existiert noch nicht.'; const t = c.readText(sys, '/home/azubi/Archiv/2026/Q4/liste.txt'); if (t === null) return 'Die Datei liste.txt fehlt im Ordner Q4.'; return t === '' ? true : 'liste.txt soll leer sein.'; },
      solution: ['mkdir -p Archiv/2026/Q4', 'touch Archiv/2026/Q4/liste.txt'], wrong: [['mkdir Archiv/2026/Q4']], tips: ['mkdir legt Ordner an, touch eine leere Datei.', 'Mit der Option -p legt mkdir fehlende Zwischenordner mit an.'],
      expl: 'mkdir -p Archiv/2026/Q4 legt die ganze Kette an. touch Archiv/2026/Q4/liste.txt erzeugt die leere Datei. Ohne -p meldet mkdir "No such file or directory", weil Archiv noch fehlt.' },
    { n: 5, kind: 'term', cat: 0, level: 3, title: 'Aufräumen im Projekt',
      text: 'Räume auf: Verschiebe alle .txt-Dateien aus ~/Downloads nach ~/Dokumente. Kopiere ~/Projekt/README.md als ~/Dokumente/README_kopie.md. Lösche den Ordner ~/Projekt/alt samt Inhalt. Alles andere bleibt, wie es ist.',
      check: sys => {
        const c = C(), dl = c.listDir(sys, '/home/azubi/Downloads') || [], dk = c.listDir(sys, '/home/azubi/Dokumente') || [];
        if (dl.some(n => n.endsWith('.txt'))) return 'In ~/Downloads liegen noch .txt-Dateien.';
        if (!['anleitung.txt', 'ideen.txt'].every(n => dk.includes(n))) return 'Die .txt-Dateien aus Downloads sind noch nicht in ~/Dokumente.';
        if (!dl.includes('foto.png') || !dl.includes('datenblatt.pdf')) return 'Es wurden auch Dateien verschoben, die keine .txt-Dateien sind.';
        if (c.readText(sys, '/home/azubi/Dokumente/README_kopie.md') !== README) return 'README_kopie.md fehlt oder hat einen anderen Inhalt als README.md.';
        if (c.readText(sys, '/home/azubi/Projekt/README.md') !== README) return 'Die Original-README.md soll im Projekt bleiben (kopieren, nicht verschieben).';
        if (c.exists(sys, '/home/azubi/Projekt/alt')) return 'Der Ordner alt existiert noch.';
        if (!c.exists(sys, '/home/azubi/Projekt/src/main.c') || !c.exists(sys, '/home/azubi/Projekt/daten.csv') || !c.exists(sys, '/home/azubi/Dokumente/bericht.txt')) return 'Es wurde zu viel gelöscht oder verschoben.';
        return true;
      },
      solution: ['mv ~/Downloads/*.txt ~/Dokumente/', 'cp ~/Projekt/README.md ~/Dokumente/README_kopie.md', 'rm -r ~/Projekt/alt'], wrong: [['rm -r ~/Projekt'], ['mv ~/Downloads/* ~/Dokumente/']],
      tips: ['Das Sternchen * steht für beliebig viele Zeichen: *.txt trifft alle Dateien, die auf .txt enden.', 'Ein Ordner mit Inhalt lässt sich nur mit rm -r löschen. Prüfe den Pfad vor dem Enter genau, es gibt keinen Papierkorb.'],
      expl: 'mv ~/Downloads/*.txt ~/Dokumente/ verschiebt nur die .txt-Dateien. cp kopiert die README (das Original bleibt). rm -r ~/Projekt/alt löscht den Ordner samt Inhalt. Vorsicht: rm -r auf den falschen Ordner richtet viel Schaden an.' },
    { n: 9, kind: 'term', cat: 1, level: 2, title: 'Skript startklar machen',
      text: 'Das Skript ~/Projekt/backup.sh lässt sich nicht starten (./backup.sh meldet einen Fehler). Es soll danach dir als Besitzer vollen Zugriff geben (lesen, schreiben, ausführen), der Gruppe nur Lesen und Ausführen und allen anderen gar keinen Zugriff.',
      cwd: '/home/azubi/Projekt',
      check: sys => { const m = C().modeOf(sys, '/home/azubi/Projekt/backup.sh'); return m === '750' ? true : 'Die Rechte stimmen noch nicht. Aktuell: ' + m + ' (ls -l zeigt sie dir als rwx-Folge).'; },
      solution: ['chmod 750 backup.sh'], wrong: [['chmod +x backup.sh'], ['chmod 755 backup.sh']], tips: ['ls -l zeigt die aktuellen Rechte. Jede Stelle (Besitzer, Gruppe, andere) hat eine eigene Ziffer.', 'lesen = 4, schreiben = 2, ausführen = 1. Addiere je Stelle: Besitzer 4+2+1, Gruppe 4+1, andere 0.'],
      expl: 'Besitzer rwx = 7, Gruppe r-x = 5, andere --- = 0, also chmod 750 backup.sh. Mit chmod +x bekämen auch die anderen das Ausführungsrecht (755), das war nicht gewollt.' },
    /* PRUEFEN P16: Aufgabe 10: Webdatei bekommt Besitzer und Gruppe www-data mit 644. In der Praxis gehört der Webroot oft root oder einem Deploy-Benutzer und ist für... */
    { n: 10, kind: 'term', cat: 1, level: 3, title: 'Datei übergeben',
      text: 'Die Datei /srv/web/index.html gehört root und ist nur für root lesbar. Der Webserver läuft als Benutzer www-data. Die Datei soll Benutzer www-data und Gruppe www-data gehören. Der Besitzer darf lesen und schreiben, alle anderen dürfen nur lesen.',
      check: sys => { const n = C().getNode(sys, '/srv/web/index.html'); if (!n) return 'Die Datei gibt es nicht mehr.'; if (n.owner !== 'www-data' || n.group !== 'www-data') return 'Besitzer und Gruppe sind noch ' + n.owner + ':' + n.group + '.'; return C().modeOf(sys, '/srv/web/index.html') === '644' ? true : 'Die Rechte sind noch nicht richtig (aktuell ' + C().modeOf(sys, '/srv/web/index.html') + ').'; },
      solution: ['sudo chown www-data:www-data /srv/web/index.html', 'sudo chmod 644 /srv/web/index.html'], wrong: [['chown www-data /srv/web/index.html'], ['sudo chown www-data:www-data /srv/web/index.html', 'sudo chmod 666 /srv/web/index.html']],
      tips: ['Den Besitzer ändert chown (Benutzer:Gruppe). Fremde Dateien darfst du nur als Administrator ändern.', 'rw- = 6, r-- = 4. Beide Änderungen brauchen sudo, weil die Datei root gehört.'],
      expl: 'sudo chown www-data:www-data /srv/web/index.html setzt Besitzer und Gruppe, sudo chmod 644 /srv/web/index.html setzt rw-r--r--. Ohne sudo verweigert Linux das Ändern (Operation not permitted).' },
    { n: 12, kind: 'term', cat: 2, level: 2, title: 'Anfang einer Tabelle',
      text: 'Speichere die ersten drei Zeilen der Datei ~/Projekt/daten.csv in einer neuen Datei ~/kopf.csv.',
      check: sys => { const t = C().readText(sys, '/home/azubi/kopf.csv'); if (t === null) return 'Die Datei ~/kopf.csv gibt es noch nicht.'; return t === FACTS.head3 ? true : 'kopf.csv hat nicht die ersten drei Zeilen von daten.csv (genau diese drei, sonst nichts).'; },
      solution: ['head -n 3 Projekt/daten.csv > kopf.csv'], wrong: [['head Projekt/daten.csv > kopf.csv'], ['tail -n 3 Projekt/daten.csv > kopf.csv']], tips: ['head zeigt den Anfang einer Datei, die Option -n legt die Zeilenzahl fest.', 'Mit > schreibst du die Ausgabe in eine Datei statt auf den Bildschirm.'],
      expl: 'head -n 3 Projekt/daten.csv > kopf.csv: head liefert die ersten drei Zeilen, > leitet sie in die Datei um. Ohne -n gibt head zehn Zeilen aus.' },
    { n: 13, kind: 'term', cat: 2, level: 2, title: 'Meldungen herausfiltern',
      text: 'Die Datei ~/Projekt/server.log enthält Meldungen verschiedener Stufen. Schreibe alle Zeilen, die das Wort ERROR enthalten (egal ob groß oder klein geschrieben), in die neue Datei ~/fehler.txt.',
      check: sys => { const t = C().readText(sys, '/home/azubi/fehler.txt'); if (t === null) return 'Die Datei ~/fehler.txt gibt es noch nicht.'; return t === FACTS.errLines ? true : 'fehler.txt enthält nicht genau die passenden Zeilen. Beachte die Schreibweise (error, ERROR).'; },
      solution: ['grep -i error Projekt/server.log > fehler.txt'], wrong: [['grep ERROR Projekt/server.log > fehler.txt'], ['grep error Projekt/server.log >> fehler.txt']], tips: ['grep sucht Zeilen mit einem Muster.', 'Die Option -i ignoriert Groß- und Kleinschreibung.'],
      expl: 'grep -i error Projekt/server.log > fehler.txt. Ohne -i fehlt die Zeile mit kleingeschriebenem "error".' },
    /* PRUEFEN P14: Auswertungen (Aufgaben 14, 27, 28) nutzen nur cut, grep, sort, uniq, wc, weil awk und sed nicht simuliert sind. Sollen awk und sed (z. B. awk '{pri... */
    { n: 14, kind: 'term', cat: 2, level: 3, title: 'Besucher zählen',
      text: 'In der Webserver-Logdatei /var/log/nginx/access.log steht in jeder Zeile zuerst die IP-Adresse des Besuchers, getrennt durch ein Leerzeichen. Zeige jede IP-Adresse mit der Zahl ihrer Anfragen an, die häufigste ganz oben (eine Befehlskette mit Pipes).',
      check: sys => { const ok = items(sys).find(x => pipes(x.cmd) >= 2 && new RegExp('^\\s*' + FACTS.topIpCount + '\\s+' + FACTS.topIp.replace(/\./g, '\\.') + '\\s*$').test(firstLine(x.out))); return ok ? true : 'Noch keine Ausgabe, bei der oben die häufigste IP mit ihrer Anzahl steht (mindestens zwei Pipes).'; },
      solution: ["cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn"], wrong: [["cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c"], ['cat /var/log/nginx/access.log']],
      tips: ['cut -d\' \' -f1 schneidet die erste Spalte aus (Trenner Leerzeichen). uniq zählt nur direkt aufeinanderfolgende gleiche Zeilen.', 'Erst sortieren (sort), dann zählen (uniq -c), dann nach der Zahl absteigend sortieren (sort -rn).'],
      expl: "cut -d' ' -f1 holt die IP, sort bringt gleiche Adressen untereinander, uniq -c zählt sie, sort -rn sortiert nach der Zahl absteigend. Ohne das zweite sort steht die Liste nach Adresse sortiert da." },
    { n: 17, kind: 'term', cat: 3, level: 2, title: 'Der Rechner wird langsam',
      text: 'Der Rechner reagiert plötzlich zäh. Finde den Prozess, der am meisten Rechenleistung (CPU) braucht, und beende ihn. Alle anderen Prozesse müssen weiterlaufen.',
      check: sys => { const p = sys.procs; if (p.some(x => x.pid === 2417)) return 'Der Prozess mit der höchsten CPU-Last läuft noch.'; return p.length === 10 ? true : 'Es wurden auch andere Prozesse beendet.'; },
      solution: ['ps aux', 'kill 2417'], wrong: [['kill 2655'], ['kill 745']], tips: ['ps aux listet alle Prozesse mit CPU-Anteil (Spalte %CPU) und Prozessnummer (PID). top sortiert nach CPU.', 'kill PID sendet dem Prozess die Bitte, sich zu beenden.'],
      expl: 'ps aux (oder top) zeigt python3 mit 97,3 % CPU und PID 2417. kill 2417 beendet ihn. Fremde Systemprozesse (nginx, sshd) dürfen weiterlaufen.' },
    /* PRUEFEN P15: Aufgabe 18: Erst kill (SIGTERM), dann kill -9 (SIGKILL). Der Tipp der Stufe 2 nennt das Signal 9, die Lösung den Befehl (Verdeckte-Fehler-Prinzip: ... */
    { n: 18, kind: 'term', cat: 3, level: 3, title: 'Ein Programm hängt',
      text: 'Dein Programm backup-sync reagiert nicht mehr. Beende es so, dass es sicher weg ist. Alle anderen Prozesse müssen weiterlaufen.',
      check: sys => { if (sys.procs.some(x => x.pid === 2655)) return 'backup-sync läuft noch (ps aux zeigt es).'; return sys.procs.length === 10 ? true : 'Es wurden auch andere Prozesse beendet.'; },
      solution: ['ps aux | grep backup', 'kill 2655', 'kill -9 2655'], wrong: [['kill 2655']], tips: ['Mit ps aux | grep backup findest du die PID. Prüfe nach dem kill noch einmal mit ps, ob der Prozess wirklich weg ist.', 'Manche Prozesse ignorieren das normale Beenden (Signal 15). Das Signal 9 kann kein Prozess ignorieren.'],
      expl: 'kill PID schickt SIGTERM (15), das ein hängender Prozess ignorieren kann. kill -9 PID schickt SIGKILL: Der Kern beendet den Prozess sofort, ohne dass er aufräumen kann. Deshalb erst die höfliche Variante, dann -9.' },
    { n: 20, kind: 'term', cat: 4, level: 2, title: 'Anmeldeprotokoll lesen',
      text: 'Zeige die letzten fünf Zeilen der Datei /var/log/auth.log an.',
      check: sys => (items(sys).some(x => x.out === FACTS.authTail5) ? true : 'Die letzten fünf Zeilen von auth.log wurden noch nicht angezeigt (lies die Fehlermeldung, falls es eine gab).'),
      solution: ['sudo tail -n 5 /var/log/auth.log'], wrong: [['tail -n 5 /var/log/auth.log']], tips: ['tail zeigt das Ende einer Datei, -n legt die Zeilenzahl fest.', 'Lies die Fehlermeldung: Auf Servern darf nicht jeder alle Protokolle lesen. ls -l /var/log zeigt, wem sie gehören.'],
      expl: 'auth.log gehört root:adm mit Rechten rw-r-----. Dein Benutzer ist nicht in der Gruppe adm, deshalb: sudo tail -n 5 /var/log/auth.log.' },
    { n: 21, kind: 'term', cat: 4, level: 2, title: 'Programm nachrüsten',
      text: 'Auf diesem Rechner fehlt das Programm tree. Installiere es und lass dir damit den Ordnerbaum von ~/Projekt anzeigen.',
      check: sys => { if (!sys.pkgs.inst.tree) return 'tree ist noch nicht installiert.'; return items(sys).some(x => /^tree\b/.test(x.cmd.trim()) && x.out.includes('src') && x.out.includes('docs')) ? true : 'tree ist installiert, aber den Baum von ~/Projekt hast du noch nicht angezeigt.'; },
      solution: ['sudo apt install -y tree', 'tree ~/Projekt'], wrong: [['apt install tree']], tips: ['Pakete installiert apt. Das Installieren ändert das ganze System.', 'Probiere zuerst den Befehl und lies die Meldung. Mit -y beantwortet apt die Rückfrage automatisch.'],
      expl: 'sudo apt install -y tree installiert das Paket (Administratorrechte nötig), danach zeigt tree ~/Projekt den Baum. Ohne sudo meldet apt, dass es die Sperrdatei nicht öffnen darf.' },
    { n: 22, kind: 'term', cat: 4, level: 3, title: 'Neuer Zugang',
      text: 'Ein neuer Kollege namens tom bekommt einen Zugang: ein Benutzer tom mit eigenem Home-Verzeichnis. Er soll außerdem sudo benutzen dürfen (Mitglied der Gruppe sudo).',
      check: sys => { const u = sys.users.tom; if (!u) return 'Den Benutzer tom gibt es noch nicht.'; if (!C().exists(sys, '/home/tom')) return 'tom hat noch kein Home-Verzeichnis.'; return u.groups.includes('sudo') ? true : 'tom ist noch nicht in der Gruppe sudo (id tom zeigt seine Gruppen).'; },
      solution: ['sudo useradd -m tom', 'sudo usermod -aG sudo tom'], wrong: [['sudo useradd tom'], ['useradd -m tom']], tips: ['useradd legt Benutzer an, usermod ändert sie. Beides geht nur als Administrator.', 'Home-Verzeichnis: Option -m bei useradd. Gruppe anhängen: usermod -aG GRUPPE BENUTZER (das a bedeutet anhängen).'],
      expl: 'sudo useradd -m tom legt Benutzer und Home an, sudo usermod -aG sudo tom hängt die Gruppe sudo an. Ohne -m fehlt das Home-Verzeichnis, ohne -a würden bisherige Zusatzgruppen ersetzt.' },
    { n: 24, kind: 'term', cat: 5, level: 2, title: 'Erreichbarkeit prüfen',
      text: 'Prüfe, ob der Fileserver mit der Adresse 192.168.10.10 erreichbar ist. Sende dazu genau zwei Anfragen (Pakete).',
      check: sys => (items(sys).some(x => /^ping\b/.test(x.cmd.trim()) && x.out.includes('2 packets transmitted, 2 received')) ? true : 'Noch keine Ausgabe, die zwei gesendete und zwei empfangene Pakete zeigt.'),
      solution: ['ping -c 2 192.168.10.10'], wrong: [['ping 192.168.10.10'], ['ping -c 2 192.168.10.99']], tips: ['Mit ping prüfst du, ob ein Rechner antwortet.', 'Ohne Option läuft ping endlos (Strg+C). Die Option -c ANZAHL begrenzt die Pakete.'],
      expl: 'ping -c 2 192.168.10.10 sendet zwei Echo-Anfragen. In der Statistik steht "2 packets transmitted, 2 received, 0% packet loss".' },
    { n: 27, kind: 'term', cat: 5, level: 3, title: 'Anmeldeversuche zählen',
      text: 'Wie oft ist in /var/log/auth.log eine Anmeldung fehlgeschlagen? Gezählt werden die Zeilen mit der Meldung "Failed password". Dein Befehl soll die Zahl ausgeben.',
      check: sys => (items(sys).some(x => x.out.trim() === String(FACTS.failed) && /grep/.test(x.cmd)) ? true : 'Es wurde noch keine Zahl ausgegeben, die zur Zahl der "Failed password"-Zeilen passt (nur die Zahl, ohne Dateiname).'),
      solution: ["sudo grep -c 'Failed password' /var/log/auth.log"], wrong: [["grep -c 'Failed password' /var/log/auth.log"], ["sudo grep 'Failed' /var/log/auth.log"]], tips: ['grep sucht Zeilen, mit -c zählt es sie nur. Muster mit Leerzeichen setzt du in Anführungszeichen.', 'Lies die Fehlermeldung. Alternativ: grep ... | wc -l zählt die Zeilen der Ausgabe.'],
      expl: "sudo grep -c 'Failed password' /var/log/auth.log gibt " + FACTS.failed + ' aus. Ohne sudo darf dein Benutzer die Datei nicht lesen.' },
    { n: 28, kind: 'term', cat: 5, level: 3, title: 'Anfragen ohne Treffer',
      text: 'In /var/log/nginx/access.log steht nach der Anfrage ein Statuscode (z. B. 200 oder 404). Welche angeforderte Seite hat am häufigsten den Statuscode 404 geliefert? Zeige die Anfragen mit ihrer Anzahl, die häufigste zuerst.',
      check: sys => { const ok = items(sys).find(x => pipes(x.cmd) >= 3 && new RegExp('^\\s*' + FACTS.top404Count + '\\s+.*' + FACTS.top404.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).test(firstLine(x.out))); return ok ? true : 'Noch keine Liste, in der oben die am häufigsten nicht gefundene Anfrage mit ihrer Anzahl steht.'; },
      solution: ["grep ' 404 ' /var/log/nginx/access.log | cut -d'\"' -f2 | sort | uniq -c | sort -rn"], wrong: [["grep ' 404 ' /var/log/nginx/access.log | cut -d'\"' -f2 | sort | uniq -c"]],
      tips: ['Erst die Zeilen mit dem Statuscode herausfiltern (grep), dann den Teil in Anführungszeichen ausschneiden: cut mit dem Trenner " (in einfache Anführungszeichen setzen).', 'Danach wie beim Zählen von IP-Adressen: sort, uniq -c, sort -rn.'],
      expl: "grep ' 404 ' filtert die Zeilen, cut -d'\"' -f2 schneidet die Anfrage zwischen den Anführungszeichen aus (z. B. GET /admin.php HTTP/1.1), sort | uniq -c zählt, sort -rn ordnet absteigend. Ergebnis: " + FACTS.top404 + ' (' + FACTS.top404Count + 'x).' },
    { n: 34, kind: 'term', cat: 6, level: 3, title: 'Zeitplan notieren',
      text: 'Das Skript /home/azubi/Projekt/backup.sh soll jeden Tag um 02:30 Uhr laufen. Schreibe die passende Cron-Zeile (Zeitangabe und Befehl, eine Zeile) in die neue Datei ~/cronjobs.txt.',
      check: sys => {
        const t = C().readText(sys, '/home/azubi/cronjobs.txt'); if (t === null) return 'Die Datei ~/cronjobs.txt gibt es noch nicht.';
        const ls = C().textLines(t).filter(l => l.trim() && !l.trim().startsWith('#')); if (ls.length !== 1) return 'In der Datei soll genau eine Cron-Zeile stehen.';
        const m = /^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/.exec(ls[0].trim()); if (!m) return 'Die Zeile braucht fünf Zeitfelder und dann den Befehl.';
        const p = C().cronParse(m[1]); if (!p.ok) return p.err;
        const only = (s, v) => s.set.size === 1 && s.set.has(v);
        if (!only(p.sets[0], 30) || !only(p.sets[1], 2)) return 'Die Uhrzeit stimmt noch nicht (Minute, dann Stunde).';
        if (!p.sets[2].star || !p.sets[3].star || !p.sets[4].star) return 'Der Job soll an jedem Tag laufen: Tag, Monat und Wochentag bleiben *.';
        return /(^|\s)\/home\/azubi\/Projekt\/backup\.sh\s*$/.test(m[2]) ? true : 'Der Befehl soll der volle Pfad /home/azubi/Projekt/backup.sh sein.';
      },
      solution: ["echo '30 2 * * * /home/azubi/Projekt/backup.sh' > cronjobs.txt"], wrong: [["echo '2 30 * * * /home/azubi/Projekt/backup.sh' > cronjobs.txt"], ["echo '30 2 * * 1 /home/azubi/Projekt/backup.sh' > cronjobs.txt"]],
      tips: ['Die fünf Felder heißen: Minute, Stunde, Tag des Monats, Monat, Wochentag. Ein Stern bedeutet "jeder".', 'Mit echo und > schreibst du eine Zeile in eine Datei. Setze den Text in einfache Anführungszeichen, damit der Stern nicht durch Dateinamen ersetzt wird.'],
      expl: "30 2 * * * bedeutet Minute 30, Stunde 2, an jedem Tag, in jedem Monat, an jedem Wochentag. Als Zeile: 30 2 * * * /home/azubi/Projekt/backup.sh. Die Reihenfolge ist Minute vor Stunde, nicht umgekehrt." }
  ];

  /* ============================================================ Auswahl- und Zahlenaufgaben (Generatoren) */
  const numQ = (text, value, unit, label, tol, expl, tips) => ({ text, ask: { type: 'num', unit, label }, value, tol, expl, tips });
  function choiceQ(R, text, right, wrong, expl, tips) {
    const ch = C().shuffle(R, [right].concat(wrong)); return { text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(right) }, value: ch.indexOf(right), tol: 0, expl, tips };
  }
  const uniqWrong = (right, cands, n) => { const o = []; cands.forEach(x => { if (x !== right && !o.includes(x)) o.push(x); }); return o.slice(0, n); };
  const pq = POOL => (R, arg) => { const i = (arg && arg.length) ? C().pick(R, arg) : C().ri(R, 0, POOL.length - 1), q = POOL[i]; return choiceQ(R, q[0], q[1], q[2], q[3], q[4]); };
  const TXT = { r: 'lesen', w: 'schreiben', x: 'ausführen' };
  const permWords = b => (b === 7 ? 'lesen, schreiben und ausführen' : b === 0 ? 'nichts (kein Zugriff)' : [b & 4 ? 'lesen' : '', b & 2 ? 'schreiben' : '', b & 1 ? 'ausführen' : ''].filter(Boolean).join(' und ').replace(/^(\w+) und (\w+) und/, '$1, $2 und'));
  const permOnly = b => (b === 7 ? 'alles (lesen, schreiben, ausführen)' : b === 0 ? 'nichts' : 'nur ' + [b & 4 ? 'lesen' : '', b & 2 ? 'schreiben' : '', b & 1 ? 'ausführen' : ''].filter(Boolean).join(' und '));
  const WHO = ['der Besitzer', 'die Gruppe', 'alle anderen'];
  const modeText = m => 'Besitzer: ' + permWords((m >> 6) & 7) + '; Gruppe: ' + permWords((m >> 3) & 7) + '; andere: ' + permWords(m & 7);

  const PATHS_ABS = ['/etc/hosts', '/home/azubi/Projekt/src', '/var/log/syslog', '/usr/bin/ls', '/tmp/test.txt', '/srv/web/index.html', '/home/anna/aufgaben.txt'];
  const PATHS_REL = ['Projekt/src', '../docs', './backup.sh', 'notizen.txt', 'src/main.c', '../../Downloads', 'Dokumente/bericht.txt', 'log/syslog'];
  const BASES = ['/home/azubi/Projekt/src', '/home/azubi/Dokumente', '/var/log/nginx', '/srv/web', '/home/azubi/Projekt/docs', '/usr/local/bin', '/etc/ssh'];
  const RELS = ['..', '../..', '../docs', '../../log', '.', '../src/util', '../../tmp'];
  const TEXTQ = [
    ['Welcher Befehl zeigt die letzten Zeilen einer Datei?', 'tail', ['head', 'cat -n', 'wc -l'], 'tail zeigt das Dateiende (standardmäßig 10 Zeilen), head den Anfang.', ['Das Ende einer Datei heißt auf Englisch "tail" (Schwanz).', 'head ist das Gegenstück für den Anfang.']],
    ['Welcher Befehl zählt die Zeilen einer Datei?', 'wc -l datei', ['cat -l datei', 'sort -n datei', 'uniq -l datei'], 'wc (word count) zählt Zeilen (-l), Wörter (-w) und Zeichen (-c).', ['wc steht für word count.', 'Die Option -l steht für lines.']],
    ['Welches Zeichen schreibt die Ausgabe eines Befehls in eine Datei und überschreibt dabei den alten Inhalt?', '>', ['>>', '|', '<'], '> legt die Datei neu an bzw. leert sie. >> hängt an. | verbindet Befehle.', ['Der Pfeil zeigt in Richtung Datei.', 'Das doppelte Zeichen hängt an.']],
    ['Welches Zeichen hängt die Ausgabe eines Befehls an das Ende einer vorhandenen Datei an?', '>>', ['>', '|', '2>'], '>> hängt an, ohne den alten Inhalt zu löschen.', ['Zwei Pfeile: weiter hinten dranhängen.', 'Ein einzelner Pfeil überschreibt.']],
    ['Was bewirkt das Pipe-Zeichen | zwischen zwei Befehlen?', 'Die Ausgabe des linken Befehls wird zur Eingabe des rechten', ['Der rechte Befehl läuft nur, wenn der linke erfolgreich war', 'Die Ausgabe wird in eine Datei geschrieben', 'Beide Befehle laufen im Hintergrund'], 'Mit | bildest du Ketten: ls | wc -l übergibt die Dateiliste an wc. Die Variante "nur bei Erfolg" ist &&.', ['Pipe heißt Röhre: Daten fließen von links nach rechts.', 'Verwechsle es nicht mit &&.']],
    ['Was leitet 2> fehler.txt um?', 'Nur die Fehlermeldungen (Standardfehlerausgabe)', ['Nur die normale Ausgabe', 'Die Ausgabe von zwei Befehlen', 'Alles, aber nur zwei Zeilen'], 'Datenstrom 1 ist die normale Ausgabe, Datenstrom 2 die Fehlerausgabe. 2> leitet nur Datenstrom 2 um.', ['Die Zahl vor > nennt den Datenstrom.', 'Normale Ausgabe ist Strom 1, Fehler sind Strom 2.']],
    ['Welcher Befehl sucht Zeilen mit dem Wort ERROR in log.txt?', 'grep ERROR log.txt', ['find ERROR log.txt', 'cut ERROR log.txt', 'sort ERROR log.txt'], 'grep MUSTER DATEI gibt alle Zeilen aus, die das Muster enthalten. find sucht Dateien, keine Textzeilen.', ['Es geht um Zeilen in einer Datei.', 'find sucht Dateinamen.']],
    ['Welcher Befehl gibt nur die erste Spalte einer Datei aus, deren Spalten durch Semikolon getrennt sind?', "cut -d';' -f1 datei", ["cut -f1 -d, datei", "sort -k1 datei", "head -c1 datei"], "cut -d legt den Trenner fest, -f die Spalte. Hier ist der Trenner das Semikolon.", ['cut schneidet Spalten aus.', 'Der Trenner muss zum Dateiformat passen.']],
    ['Welche Option macht grep unempfindlich gegen Groß- und Kleinschreibung?', '-i', ['-v', '-c', '-n'], '-i ignoriert die Schreibweise, -v kehrt um, -c zählt, -n zeigt Zeilennummern.', ['i wie ignore.', 'Die anderen Optionen tun etwas anderes.']]
  ];
  const PROZQ = [
    ['Wie startest du den Befehl sleep 60 im Hintergrund?', 'sleep 60 &', ['sleep 60 |', 'sleep 60 >', 'bg sleep 60 !'], 'Ein & am Ende startet den Befehl im Hintergrund; die Shell gibt dir sofort wieder den Prompt.', ['Das Zeichen steht am Zeilenende.', 'Es ist das Und-Zeichen.']],
    ['Mit welchem Befehl listest du alle laufenden Prozesse auf?', 'ps aux', ['ls -p', 'jobs -a', 'cat /proc'], 'ps aux zeigt alle Prozesse mit Benutzer, PID, CPU- und Speicheranteil.', ['ps steht für process status.', 'jobs zeigt nur Hintergrundjobs der eigenen Shell.']],
    ['Was bewirkt kill 4711 ohne weitere Option?', 'Der Prozess bekommt das Signal SIGTERM (Bitte, sich zu beenden)', ['Der Prozess wird sofort hart beendet', 'Der Prozess wird pausiert', 'Alle Prozesse des Benutzers werden beendet'], 'Standard ist Signal 15 (SIGTERM). Der Prozess kann aufräumen, aber auch ignorieren. Hart beendet kill -9.', ['kill schickt Signale, ohne Zahl ist es das Standardsignal.', 'Die harte Variante hat die Zahl 9.']],
    ['Wann brauchst du kill -9?', 'Wenn ein Prozess auf das normale Beenden nicht reagiert', ['Immer, damit es schneller geht', 'Wenn du einen Prozess nur anhalten willst', 'Wenn du ihn im Hintergrund starten willst'], 'kill -9 (SIGKILL) beendet sofort, der Prozess kann nichts mehr aufräumen (offene Dateien, temporäre Daten). Daher nur als letzter Schritt.', ['Erst die höfliche Variante, dann die harte.', 'SIGKILL kann nicht abgefangen werden.']],
    ['Was zeigt der Befehl top?', 'Laufende Prozesse mit CPU- und Speicherlast, laufend aktualisiert', ['Die Dateien im aktuellen Ordner', 'Die letzten Zeilen einer Logdatei', 'Alle Benutzer des Systems'], 'top ist die Live-Übersicht der Prozesse, sortiert nach CPU-Last. Mit q beendest du es.', ['Der Name kommt von "table of processes"; es ist eine Live-Ansicht.', 'Mit q beenden.']],
    ['In der Ausgabe von ps aux: Welche Spalte enthält die Prozessnummer?', 'PID', ['STAT', 'TTY', 'VSZ'], 'PID ist die Prozess-ID, die kill erwartet. STAT ist der Zustand, TTY das Terminal.', ['Die Nummer, die du bei kill angibst.', 'Process ID.']],
    ['Was zeigt der Befehl jobs?', 'Die Hintergrundjobs der aktuellen Shell', ['Alle Prozesse des Rechners', 'Die geplanten Cron-Jobs', 'Die Arbeitszeiten des Benutzers'], 'jobs listet nur Jobs, die du in dieser Shell mit & gestartet hast. Cron-Jobs zeigt crontab -l.', ['Es geht nur um die eigene Shell.', 'ps aux zeigt alle Prozesse.']]
  ];
  const CRONQ = [['30 2 * * *', 'Jeden Tag um 02:30 Uhr'], ['0 * * * *', 'Jede Stunde zur vollen Stunde'], ['*/15 * * * *', 'Alle 15 Minuten'], ['0 8 * * 1-5', 'Montag bis Freitag um 08:00 Uhr'], ['0 0 1 * *', 'Am ersten Tag jedes Monats um Mitternacht'],
    ['15 22 * * 0', 'Jeden Sonntag um 22:15 Uhr'], ['0 */2 * * *', 'Alle zwei Stunden zur vollen Stunde'], ['45 17 * * 5', 'Jeden Freitag um 17:45 Uhr'], ['0 6 15 * *', 'Am 15. jedes Monats um 06:00 Uhr'], ['0 12 * * *', 'Jeden Tag um 12:00 Uhr'], ['30 7 1 1 *', 'Am 1. Januar um 07:30 Uhr'], ['*/5 8-17 * * 1-5', 'Werktags zwischen 8 und 17 Uhr alle fünf Minuten']];
  /* PRUEFEN P17: Cron-Aufgaben: "Läufe pro Tag" zählt Minuten mal Stunden (Tag, Monat, Wochentag je *). Die Pool-Zeitangaben (u. a. 0 8 * * 1-5, * /15 8-17 * * 1-5, ... */
  const CRONN = [['0 */4 * * *', 6, 'Alle 4 Stunden zur vollen Stunde: 0, 4, 8, 12, 16, 20 Uhr = 6 Läufe.'], ['*/15 * * * *', 96, '4 Läufe pro Stunde mal 24 Stunden = 96.'], ['30 8,12,16 * * *', 3, 'Minute 30 in den Stunden 8, 12 und 16 = 3 Läufe.'], ['0 8-17 * * *', 10, 'Die Stunden 8 bis 17 sind 10 Stunden, je ein Lauf zur vollen Stunde = 10.'],
    ['*/10 9-11 * * *', 18, '6 Läufe pro Stunde (Minute 0, 10, ... 50) mal 3 Stunden (9, 10, 11) = 18.'], ['0,30 * * * *', 48, 'Zwei Läufe pro Stunde (Minute 0 und 30) mal 24 = 48.'], ['*/20 * * * *', 72, '3 Läufe pro Stunde (0, 20, 40) mal 24 = 72.'], ['15 */6 * * *', 4, 'Alle 6 Stunden (0, 6, 12, 18 Uhr), jeweils Minute 15 = 4 Läufe.']];

  const G = {
    pfad1: R => {
      const c = C(), abs = c.pick(R, [true, false]), right = c.pick(R, abs ? PATHS_ABS : PATHS_REL), wrong = c.shuffle(R, abs ? PATHS_REL : PATHS_ABS).slice(0, 3);
      return choiceQ(R, 'Welcher der folgenden Pfade ist ' + (abs ? 'ein absoluter' : 'ein relativer') + ' Pfad?', right, wrong, 'Ein absoluter Pfad beginnt mit / (Wurzelverzeichnis) und gilt von überall. Ein relativer Pfad beginnt nicht mit / und wird vom aktuellen Ordner aus gelesen (. = hier, .. = eine Ebene höher).', ['Schau auf das erste Zeichen.', 'Ein / ganz am Anfang bedeutet: Start im Wurzelverzeichnis.']);
    },
    pfad2: R => {
      const c = C(), base = c.pick(R, BASES), rel = c.pick(R, RELS), res = c.norm({ cwd: base, users: {}, user: '' }, rel), up = (p, n) => { const a = p.split('/').filter(Boolean); return '/' + a.slice(0, Math.max(0, a.length - n)).join('/'); };
      const wr = [base + '/' + rel, up(res, 1), res === base ? up(base, 1) : base, c.norm({ cwd: base, users: {}, user: '' }, rel + '/..'), '/' + res.split('/').filter(Boolean).slice(-1).join('/'), c.norm({ cwd: up(base, 1), users: {}, user: '' }, rel)];
      const clean = x => !/(^|\/)\.\.?(\/|$)/.test(x), w3 = uniqWrong(res, wr.filter(clean), 3); while (w3.length < 3) w3.push(c.pick(R, BASES).replace(/\/[^/]+$/, '') || '/etc');
      return choiceQ(R, 'Du stehst im Ordner ' + base + '. In welchem Ordner stehst du nach  cd ' + rel + ' ?', res, uniqWrong(res, w3.concat(['/']), 3), 'Ausgangspunkt ' + base + ', Schritt für Schritt: ' + rel.split('/').map(s => s === '..' ? '.. (eine Ebene hoch)' : s === '.' ? '. (bleibt)' : s + ' (hinein)').join(', ') + '. Ergebnis: ' + res + '.', ['Gehe die Teile des Pfades einzeln durch.', '.. geht eine Ebene nach oben, . bleibt im selben Ordner.']);
    },
    rwxlesen: R => {
      const c = C(), modes = [0o754, 0o640, 0o750, 0o644, 0o700, 0o664, 0o755, 0o600, 0o770, 0o705, 0o604], m = c.pick(R, modes), cls = c.ri(R, 0, 2), bits = (m >> (6 - 3 * cls)) & 7, nm = c.pick(R, ['skript.sh', 'bericht.txt', 'daten.csv', 'start.sh']);
      const line = '-' + c.modeSym(m) + ' 1 anna dev ' + c.ri(R, 300, 9000) + ' Nov  3 10:15 ' + nm, who = ['Welche Rechte hat der Besitzer (anna)?', 'Welche Rechte hat die Gruppe dev?', 'Welche Rechte haben alle anderen Benutzer (nicht anna, nicht in der Gruppe dev)?'][cls];
      const all = [0, 1, 2, 3, 4, 5, 6, 7].filter(b => b !== bits).map(permOnly);
      return choiceQ(R, 'Eine Datei wird so aufgelistet:  ' + line + '  ' + who, permOnly(bits), c.shuffle(R, all).slice(0, 3), 'Die neun Zeichen nach dem Dateityp stehen in drei Dreiergruppen: Besitzer, Gruppe, andere (je r = lesen, w = schreiben, x = ausführen, - = fehlt). Hier: ' + c.modeSym(m).replace(/(...)(...)(...)/, '$1 | $2 | $3') + '. ' + ['Besitzer', 'Gruppe', 'Andere'][cls] + ': ' + permOnly(bits) + '.', ['Teile die neun Zeichen in drei Gruppen zu je drei.', 'Erste Gruppe Besitzer, zweite Gruppe, dritte alle anderen.']);
    },
    oktal: R => {
      const c = C(), modes = [0o640, 0o754, 0o755, 0o644, 0o600, 0o750, 0o664, 0o700, 0o751, 0o444, 0o711, 0o770], m = c.pick(R, modes), sym = c.modeSym(m);
      return numQ('Welche dreistellige Oktalzahl (für chmod) entspricht den Rechten  ' + sym + '  ?', parseInt(c.modeOct(m), 10), '', 'Oktalzahl', 0,
        'Pro Gruppe zählst du r = 4, w = 2, x = 1 zusammen. ' + sym.replace(/(...)(...)(...)/, '$1 | $2 | $3') + ' ergibt ' + [0, 1, 2].map(i => ((m >> (6 - 3 * i)) & 7)).join(', ') + ', also ' + c.modeOct(m) + '.', ['r = 4, w = 2, x = 1; ein Strich zählt 0.', 'Rechne jede Dreiergruppe einzeln und schreibe die drei Ziffern nebeneinander.']);
    },
    chmodbed: R => {
      const c = C(), modes = [0o754, 0o640, 0o751, 0o764, 0o640, 0o705, 0o752, 0o741], m = c.pick(R, modes), d = [(m >> 6) & 7, (m >> 3) & 7, m & 7], mk = a => modeText((a[0] << 6) | (a[1] << 3) | a[2]);
      const wr = [mk([d[2], d[1], d[0]]), mk([d[1], d[0], d[2]]), mk([d[0], d[2], d[1]]), mk([d[0], d[1], (d[2] + 2) % 8]), mk([(d[0] + 1) % 8, d[1], d[2]])];
      return choiceQ(R, 'Was bewirkt  chmod ' + c.modeOct(m) + ' datei  ?', mk(d), uniqWrong(mk(d), c.shuffle(R, wr), 3), 'Die drei Ziffern gehören der Reihe nach zu Besitzer, Gruppe und anderen. ' + d.join(', ') + ' bedeutet: ' + mk(d) + '.', ['Zerlege die Zahl in ihre drei Ziffern.', 'Jede Ziffer ist eine Summe aus 4 (lesen), 2 (schreiben), 1 (ausführen).']);
    },
    textbefehl: pq(TEXTQ),
    pipeles: R => {
      const c = C(), W = ['apfel', 'birne', 'kiwi', 'mango', 'pflaume'], n = c.ri(R, 5, 7), list = []; for (let i = 0; i < n; i++) list.push(c.pick(R, W)); if (new Set(list).size < 3) { list[0] = 'apfel'; list[1] = 'birne'; list[2] = 'kiwi'; }
      const content = list.join(NL) + NL, T = [['sort | uniq -c', 'Jede Zeile einmal, davor die Anzahl (sortiert)'], ['sort -u', 'Jede Zeile einmal, ohne Anzahl (sortiert)'], ['sort | uniq -d', 'Nur Zeilen, die mehrfach vorkommen'], ['uniq -c', 'Aufeinanderfolgende gleiche Zeilen mit Anzahl, ohne vorher zu sortieren'], ['sort -r | head -n 2', 'Die zwei in umgekehrter Reihenfolge ganz oben'], ['grep -v apfel | wc -l', 'Die Zahl der Zeilen ohne apfel']];
      const run = cmd => { const sys = c.newSystem({ files: [{ p: '/home/azubi/liste.txt', m: 0o644, o: 'azubi', g: 'azubi', c: content }] }); return c.run(sys, 'cat liste.txt | ' + cmd).stdout.trim(); };
      const ti = c.ri(R, 0, T.length - 1), t = T[ti], right = run(t[0]), others = []; T.forEach((x, i) => { if (i !== ti) others.push(run(x[0])); });
      const wr = uniqWrong(right, c.shuffle(R, others), 3); let k = 0; while (wr.length < 3) { wr.push(right + ' ' + (++k)); }
      const show = s => s.split(NL).map(l => l.trim()).join(' / ');
      return choiceQ(R, 'Die Datei liste.txt enthält diese Zeilen (nacheinander): ' + list.join(', ') + '.  Was gibt  cat liste.txt | ' + t[0] + '  aus? (Zeilenwechsel sind mit / dargestellt.)', show(right), wr.map(show), 'Die Befehlskette arbeitet von links nach rechts. Ergebnis: ' + show(right) + '. (' + t[1] + ')', ['Gehe die Pipe Stück für Stück durch und schreibe das Zwischenergebnis auf.', 'sort ordnet alphabetisch; uniq arbeitet nur mit direkt aufeinanderfolgenden gleichen Zeilen.']);
    },
    prozbegr: pq(PROZQ),
    userid: R => {
      const c = C(), extra = c.pick(R, [[], ['sudo'], ['adm'], ['dev', 'docker'], ['sudo', 'adm'], ['dialout']]), nm = c.pick(R, ['azubi', 'anna', 'tom', 'lena']), uid = c.pick(R, [1000, 1001, 1002]), GID = { sudo: 27, adm: 4, dev: 1002, docker: 998, dialout: 20 };
      const idl = 'uid=' + uid + '(' + nm + ') gid=' + uid + '(' + nm + ') groups=' + uid + '(' + nm + ')' + extra.map(g => ',' + GID[g] + '(' + g + ')').join(''), has = extra.includes('sudo'), variant = c.pick(R, ['sudo', 'prim']);
      if (variant === 'sudo') return choiceQ(R, 'Der Befehl id gibt aus:  ' + idl + '  Darf dieser Benutzer sudo benutzen?', has ? 'Ja, er ist Mitglied der Gruppe sudo' : 'Nein, die Gruppe sudo fehlt', has ? ['Nein, nur root darf sudo benutzen', 'Nein, weil die UID größer als 1000 ist', 'Nur, wenn er in der Gruppe adm ist'] : ['Ja, jeder Benutzer mit eigener UID darf sudo benutzen', 'Ja, weil er eine eigene Gruppe mit seinem Namen hat', 'Ja, die Gruppe adm reicht dafür'], 'Wer sudo nutzen darf, steht bei Ubuntu in der Gruppe sudo (hier groups=...). ' + (has ? 'Die Gruppe ist vorhanden.' : 'Die Gruppe fehlt in der Liste.'), ['Lies die Liste hinter groups=.', 'Gesucht ist die Gruppe mit dem Namen sudo.']);
      return choiceQ(R, 'Der Befehl id gibt aus:  ' + idl + '  Wie heißt die primäre Gruppe des Benutzers?', nm, uniqWrong(nm, ['root', 'sudo', 'users', extra[0] || 'staff', 'adm'], 3), 'Hinter gid= steht die primäre Gruppe. Unter Ubuntu hat jeder Benutzer eine eigene Gruppe mit seinem Namen.', ['Die primäre Gruppe steht hinter gid=.', 'Die Liste groups= enthält zusätzlich die Nebengruppen.']);
    },
    ipa: R => {
      const c = C(), net = c.pick(R, [[10, 0, 5, 23], [192, 168, 1, 77], [192, 168, 10, 25], [172, 16, 4, 120]]), p = c.pick(R, [24, 24, 16, 23, 25, 26]), ip = net.join('.'), variant = c.pick(R, ['ip', 'mask']);
      if (variant === 'ip') { const gw = net.slice(0, 3).join('.') + '.1'; return choiceQ(R, 'Ausschnitt aus ip a:  "2: eth0: ... inet ' + ip + '/' + p + ' scope global eth0"  und  "1: lo: ... inet 127.0.0.1/8 scope host lo".  Welche IP-Adresse hat die Netzwerkkarte eth0?', ip, uniqWrong(ip, ['127.0.0.1', gw, net.slice(0, 3).join('.') + '.255', '255.255.255.0'], 3), 'Bei der Schnittstelle eth0 steht hinter inet die IP-Adresse (hier ' + ip + ') mit der Präfixlänge /' + p + '. 127.0.0.1 gehört zur Schnittstelle lo (Loopback, der Rechner selbst).', ['Achte darauf, zu welcher Schnittstelle die Zeile gehört.', 'lo ist die Loopback-Schnittstelle.']); }
      const mask = c.maskOf(p); return choiceQ(R, 'In der Ausgabe von ip a steht  inet ' + ip + '/' + p + '.  Welche Subnetzmaske entspricht dem Präfix /' + p + '?', mask, uniqWrong(mask, ['255.255.255.0', '255.255.0.0', '255.255.254.0', '255.255.255.128', '255.255.255.192', '255.0.0.0'], 3), '/' + p + ' bedeutet: die ersten ' + p + ' Bits der Adresse sind das Netz. Das ergibt die Maske ' + mask + '.', ['Das Präfix zählt die Einsen von links.', '/24 sind drei volle Blöcke: 255.255.255.0.']);
    },
    ss: R => {
      const c = C(), S = [['22', '0.0.0.0'], ['80', '0.0.0.0'], ['443', '0.0.0.0'], ['3306', '127.0.0.1'], ['631', '127.0.0.1'], ['5432', '127.0.0.1'], ['8080', '0.0.0.0']], variant = c.pick(R, ['lokal', 'offen']);
      const lokal = S.filter(x => x[1] === '127.0.0.1'), offen = S.filter(x => x[1] === '0.0.0.0'), one = variant === 'lokal' ? c.pick(R, lokal) : c.pick(R, offen), others = c.shuffle(R, variant === 'lokal' ? offen : lokal).slice(0, 3), show = c.shuffle(R, [one].concat(others));
      const tbl = 'State  Local Address:Port | ' + show.map(x => 'LISTEN ' + x[1] + ':' + x[0]).join(' | ');
      return choiceQ(R, 'Ausschnitt aus ss -tuln:  ' + tbl + '.  ' + (variant === 'lokal' ? 'Auf welchem Port lauscht ein Dienst nur lokal (nur vom Rechner selbst erreichbar)?' : 'Auf welchem Port lauscht ein Dienst auf allen Schnittstellen (von anderen Rechnern erreichbar)?'), one[0], others.map(x => x[0]), '0.0.0.0 heißt: auf allen Schnittstellen. 127.0.0.1 heißt: nur lokal. ' + (variant === 'lokal' ? 'Nur lokal ist Port ' : 'Auf allen Schnittstellen lauscht Port ') + one[0] + '.', ['Schau auf die Adresse vor dem Doppelpunkt.', '0.0.0.0 = alle, 127.0.0.1 = nur der Rechner selbst.']);
    },
    logzeile: R => {
      const c = C(), usr = c.pick(R, ['admin', 'root', 'test', 'oracle', 'pi', 'guest']), ip = c.pick(R, ['203.0.113.7', '198.51.100.23', '192.0.2.44', '198.51.100.99']), t = c.pick(R, ['06:31:02', '08:44:50', '13:07:21', '22:15:09', '03:48:33']), port = c.ri(R, 40000, 60000), who = c.pick(R, ['anna', 'azubi', 'tom']), cmd = c.pick(R, ['/usr/bin/apt update', '/usr/bin/systemctl restart nginx', '/usr/bin/tail /var/log/auth.log']);
      const v = c.pick(R, ['user', 'ip', 'zeit', 'cmd']);
      if (v === 'cmd') return choiceQ(R, 'Zeile aus /var/log/auth.log:  Nov  8 ' + t + ' tonfunk-pc sudo:   ' + who + ' : TTY=pts/0 ; PWD=/home/' + who + ' ; USER=root ; COMMAND=' + cmd + '  Welchen Befehl hat ' + who + ' mit sudo ausgeführt?', cmd, uniqWrong(cmd, ['/usr/bin/apt update', '/usr/bin/systemctl restart nginx', '/usr/bin/tail /var/log/auth.log', '/bin/bash', '/usr/sbin/reboot'], 3), 'Hinter COMMAND= steht der Befehl, hinter USER= der Benutzer, als der er lief.', ['Suche das Wort COMMAND=.', 'Alles dahinter ist der Befehl.']);
      const line = 'Nov  8 ' + t + ' tonfunk-pc sshd[2201]: Failed password for invalid user ' + usr + ' from ' + ip + ' port ' + port + ' ssh2';
      if (v === 'user') return choiceQ(R, 'Zeile aus /var/log/auth.log:  ' + line + '  Welcher Benutzername wurde beim Anmeldeversuch eingegeben?', usr, uniqWrong(usr, ['admin', 'root', 'test', 'oracle', 'pi', 'guest', 'azubi'], 3), 'Nach "invalid user" steht der eingegebene Name. "invalid" heißt: diesen Benutzer gibt es auf dem System nicht.', ['Lies nach den Wörtern "invalid user".', 'Der Name steht vor dem Wort "from".']);
      if (v === 'ip') return choiceQ(R, 'Zeile aus /var/log/auth.log:  ' + line + '  Von welcher IP-Adresse kam der Anmeldeversuch?', ip, uniqWrong(ip, ['203.0.113.7', '198.51.100.23', '192.0.2.44', '198.51.100.99', '192.168.10.25'], 3), 'Hinter "from" steht die Adresse des Absenders, danach der Port ' + port + '.', ['Die Adresse steht hinter dem Wort "from".', 'Die Zahl hinter "port" ist keine IP-Adresse.']);
      return choiceQ(R, 'Zeile aus /var/log/auth.log:  ' + line + '  Um wie viel Uhr geschah das?', t, uniqWrong(t, ['06:31:02', '08:44:50', '13:07:21', '22:15:09', '03:48:33', '11:11:11'], 3), 'Am Zeilenanfang stehen Datum und Uhrzeit (Monat, Tag, hh:mm:ss).', ['Der Zeitstempel steht ganz vorn.', 'Er hat die Form hh:mm:ss.']);
    },
    cronlesen: R => { const c = C(), i = c.ri(R, 0, CRONQ.length - 1), q = CRONQ[i], wr = c.shuffle(R, CRONQ.filter((_, k) => k !== i)).slice(0, 3).map(x => x[1]); return choiceQ(R, 'Wann läuft ein Cron-Job mit der Zeitangabe  ' + q[0] + '  ?', q[1], wr, 'Die fünf Felder sind Minute, Stunde, Tag des Monats, Monat, Wochentag. ' + q[0] + ' bedeutet: ' + q[1].charAt(0).toLowerCase() + q[1].slice(1) + '. Mit */n ist ein Rhythmus gemeint, a-b ein Bereich, a,b eine Liste, * jeder Wert.', ['Lies die Felder von links: Minute, Stunde, Tag, Monat, Wochentag.', '* steht für "jeder", */15 für "alle 15".']); },
    cronzahl: R => { const c = C(), x = c.pick(R, CRONN); return numQ('Wie oft läuft ein Cron-Job mit  ' + x[0] + '  an einem Tag, an dem er laufen darf (Tag, Monat und Wochentag sind jeweils *)?', c.cronPerDay(x[0]), 'mal', 'Läufe pro Tag', 0, x[2], ['Zähle, wie viele Minuten pro Stunde passen und in wie vielen Stunden der Job läuft.', 'Läufe pro Tag = Zahl der Minutenwerte mal Zahl der Stundenwerte.']); },
    skriptlesen: R => {
      const c = C(), v = c.pick(R, ['text', 'if', 'sub', 'quote']);
      if (v === 'text') { const nm = c.pick(R, ['Anna', 'Jonas', 'Lea', 'Mehmet']), age = c.ri(R, 17, 25), out = 'Hallo ' + nm + ', du bist ' + age; return choiceQ(R, 'Was gibt dieses Skript aus?  name="' + nm + '"; alter=' + age + '; echo "Hallo $name, du bist $alter"', out, ['Hallo name, du bist alter', 'Hallo $name, du bist $alter', 'Hallo ' + nm + ', du bist'], 'Innerhalb doppelter Anführungszeichen ersetzt die Shell $name und $alter durch die Werte der Variablen.', ['Variablen werden mit $ gelesen.', 'Doppelte Anführungszeichen lassen die Ersetzung zu.']); }
      if (v === 'quote') { const nm = c.pick(R, ['Anna', 'Jonas', 'Lea']); return choiceQ(R, 'Was gibt dieses Skript aus?  name="' + nm + "\"; echo 'Hallo $name'", 'Hallo $name', ['Hallo ' + nm, 'Hallo', 'Hallo name'], 'In einfachen Anführungszeichen bleibt der Text wörtlich: $name wird nicht ersetzt. Mit doppelten Anführungszeichen käme "Hallo ' + nm + '".', ['Einfache und doppelte Anführungszeichen verhalten sich verschieden.', 'In einfachen Anführungszeichen wird nichts ersetzt.']); }
      if (v === 'if') { const z = c.ri(R, 2, 9), g = c.ri(R, 3, 7), big = z > g; return choiceQ(R, 'Was gibt dieses Skript aus?  zahl=' + z + ';  if [ $zahl -gt ' + g + ' ]; then echo "gross"; else echo "klein"; fi', big ? 'gross' : 'klein', [big ? 'klein' : 'gross', 'gross klein', 'nichts'], '-gt bedeutet "größer als". ' + z + (big ? ' ist größer als ' : ' ist nicht größer als ') + g + ', also läuft der ' + (big ? 'then' : 'else') + '-Zweig.', ['-gt heißt greater than.', 'Prüfe, ob die Bedingung stimmt, und wähle then oder else.']); }
      const sys = c.newSystem({}); const out = c.run(sys, 'echo "Datum: $(date +%F)"').stdout.trim();
      return choiceQ(R, 'Was gibt dieses Skript am 8. November 2026 aus?  heute=$(date +%F); echo "Datum: $heute"', out, ['Datum: $(date +%F)', 'Datum: heute', 'Datum: 08.11.2026'], '$(...) führt den Befehl aus und setzt seine Ausgabe ein. date +%F liefert das Datum als Jahr-Monat-Tag (2026-11-08).', ['$( ) ersetzt sich durch die Ausgabe des Befehls darin.', '%F ist das Format Jahr-Monat-Tag.']);
    },
    skriptfor: R => {
      const c = C(), v = c.pick(R, ['liste', 'seq', 'mod']);
      if (v === 'liste') { const n = c.ri(R, 3, 7), items = ['rot', 'gruen', 'blau', 'gelb', 'weiss', 'grau', 'rosa'].slice(0, n); return numQ('Wie viele Zeilen gibt dieses Skript aus?  for farbe in ' + items.join(' ') + '; do echo "Farbe: $farbe"; done', n, 'Zeilen', 'Zahl der Ausgabezeilen', 0, 'Die Schleife läuft einmal pro Element der Liste (' + items.join(', ') + ') und gibt je eine Zeile aus: ' + n + ' Zeilen.', ['Zähle die Elemente hinter in.', 'Pro Durchlauf kommt ein echo.']); }
      if (v === 'seq') { const a = c.ri(R, 1, 4), b = c.ri(R, 6, 12); return numQ('Wie viele Zeilen gibt dieses Skript aus?  for i in $(seq ' + a + ' ' + b + '); do echo "Runde $i"; done', b - a + 1, 'Zeilen', 'Zahl der Ausgabezeilen', 0, 'seq ' + a + ' ' + b + ' zählt von ' + a + ' bis ' + b + ' (beide eingeschlossen): ' + (b - a + 1) + ' Zahlen, also ' + (b - a + 1) + ' Zeilen.', ['seq a b liefert alle Zahlen von a bis b.', 'Beide Grenzen gehören dazu.']); }
      const n = c.ri(R, 5, 10); let k = 0; for (let i = 1; i <= n; i++) if (i % 2 === 0) k++;
      return numQ('Wie viele Zeilen gibt dieses Skript aus?  for n in $(seq 1 ' + n + '); do if [ $((n % 2)) -eq 0 ]; then echo $n; fi; done', k, 'Zeilen', 'Zahl der Ausgabezeilen', 0, 'Ausgegeben werden nur gerade Zahlen (Rest 0 bei Teilung durch 2) zwischen 1 und ' + n + ': ' + k + ' Zeilen.', ['n % 2 ist der Rest bei Teilung durch 2.', 'Zähle die geraden Zahlen von 1 bis zur Grenze.']);
    },
    /* PRUEFEN P18: Skriptfehler-Katalog: Die gezeigten Bash-Meldungen (z. B. "zahl: command not found", "[5: command not found") sind vereinfacht und können je nach B... */
    skriptfehler: R => {
      const BUG = [
        ['zahl = 5' + NL + 'echo $zahl', 'zahl: command not found', 'Bei einer Zuweisung dürfen keine Leerzeichen um das = stehen (zahl=5).'],
        ['x=5' + NL + 'if [$x -gt 3]; then echo gross; fi', '[5: command not found', 'In [ ] gehört vor und nach den Klammern ein Leerzeichen ([ $x -gt 3 ]).'],
        ['a=3; b=5' + NL + 'echo "Summe: $a + $b"  (erwartet: Summe: 8)', 'Summe: 3 + 5', 'Gerechnet wird nur in $(( ... )); im Text werden die Variablen bloß eingesetzt: echo "Summe: $((a + b))".'],
        ['Skript start.sh mit Inhalt  #!/bin/bash  echo Hallo  wird mit  ./start.sh  aufgerufen', 'bash: ./start.sh: Permission denied', 'Dem Skript fehlt das Ausführungsrecht (chmod +x start.sh).'],
        ['for i in 1 2 3; echo $i; done', "syntax error near unexpected token `echo'", 'Nach der Liste fehlt das Wort do ("for i in 1 2 3; do echo $i; done").'],
        ['$name="Anna"' + NL + 'echo $name', 'bash: =Anna: command not found', 'Beim Zuweisen steht kein $ vor dem Variablennamen (name="Anna"); das $ ist nur zum Lesen.']];
      const c = C(), i = c.ri(R, 0, BUG.length - 1), b = BUG[i], wr = c.shuffle(R, BUG.filter((_, k) => k !== i)).slice(0, 3).map(x => x[2]);
      return choiceQ(R, 'Ein Skript soll etwas Einfaches tun, tut aber etwas anderes:  ' + b[0] + '  Meldung bzw. Ergebnis: ' + b[1] + '.  Woran liegt es?', b[2], wr, b[2], ['Lies die Meldung genau und vergleiche mit der Schreibweise der Shell.', 'Die Shell ist bei Leerzeichen und Sonderzeichen sehr streng.']);
    }
  };

  /* ============================================================ Aufgabenliste (lin1 .. lin34) */
  /* Reihenfolge: Kategorie-Index, Stufe, Titel, Generator (für Auswahl-/Zahlenaufgaben) */
  const GEN = { 1: ['pfad1', 0, 1, 'Pfad erkennen'], 3: ['pfad2', 0, 2, 'Ziel eines Wechselbefehls'], 6: ['rwxlesen', 1, 1, 'Rechte lesen'], 7: ['oktal', 1, 2, 'Rechte als Zahl'], 8: ['chmodbed', 1, 2, 'Zahl als Rechte'], 11: ['textbefehl', 2, 1, 'Das passende Werkzeug'], 15: ['pipeles', 2, 3, 'Ausgabe einer Befehlskette'],
    16: ['prozbegr', 3, 1, 'Prozesse und Signale'], 19: ['userid', 4, 1, 'Benutzer und Gruppen lesen'], 23: ['ipa', 5, 1, 'Netzwerkangaben lesen'], 25: ['ss', 5, 2, 'Offene Ports lesen'], 26: ['logzeile', 5, 2, 'Logzeile lesen'], 29: ['cronlesen', 6, 1, 'Zeitangabe lesen'], 30: ['cronzahl', 6, 2, 'Läufe pro Tag'], 31: ['skriptlesen', 6, 2, 'Skript lesen'], 32: ['skriptfor', 6, 3, 'Schleife zählen'], 33: ['skriptfehler', 6, 3, 'Skript mit Fehler'] };
  const tasks = []; for (let n = 1; n <= 34; n++) {
    const tm = TERM.find(x => x.n === n);
    if (tm) tasks.push(Object.assign({ id: 'lin' + n }, tm, { cat: CATS[tm.cat], catIdx: tm.cat }));
    else { const g = GEN[n]; tasks.push({ id: 'lin' + n, kind: 'choice', cat: CATS[g[1]], catIdx: g[1], level: g[2], title: g[3], gen: g[0] }); }
  }
  /* Zufalls-Trainer und Aufgaben (Auswahl/Zahl) nutzen G; Terminal-Aufgaben liefern eine Beschreibung */
  function make(t, R) {
    let q;
    if (t.kind === 'term') q = { text: t.text, ask: { type: 'term' }, value: 0, tol: 0, expl: t.expl, tips: t.tips, solution: t.solution };
    else q = G[t.gen](R, t.arg);
    q.id = t.id; q.cat = t.cat; q.level = t.level; q.title = t.title; return q;
  }
  const makeTask = t => make(t, C().rng('lin-' + t.id));
  function randomQ(R, level) { const pool = tasks.filter(t => t.kind !== 'term' && (!level || t.level === level)), t = pool[Math.floor(R() * pool.length)]; return make(t, C().rng(Math.floor(R() * 4294967296))); }
  /* Musterlösung auf einem frischen System ausführen */
  function runSolution(t) { const sys = image({ cwd: t.cwd }); C().runAll(sys, t.solution); return sys; }
  function runWrong(t, i) { const sys = image({ cwd: t.cwd }); C().runAll(sys, t.wrong[i]); return sys; }

  /* ============================================================ Beispiele (?bsp) */
  /* tab 'term': Befehle werden beim Anzeigen auf einem frischen System ausgeführt; 'rechte' und 'cron' laden die Rechner */
  const examples = [
    { id: 'nav1', tab: 'term', title: 'Orientierung: wo bin ich, was liegt hier?', text: 'pwd zeigt den aktuellen Ordner, ls den Inhalt, cd wechselt. ~ steht für dein Home-Verzeichnis, .. für den übergeordneten Ordner.', cmds: ['pwd', 'ls', 'cd Projekt/src', 'pwd', 'cd ../docs', 'ls -l', 'cd ~', 'pwd'] },
    { id: 'dat1', tab: 'term', title: 'Dateien anlegen, kopieren, verschieben, löschen', text: 'mkdir legt Ordner an (-p mit Zwischenordnern), touch leere Dateien, cp kopiert (Ordner mit -r), mv verschiebt oder benennt um, rm löscht endgültig.', cmds: ['mkdir -p Ablage/2026', 'touch Ablage/2026/neu.txt', 'cp notizen.txt Ablage/', 'mv Ablage/notizen.txt Ablage/2026/einkauf.txt', 'ls -R Ablage', 'rm Ablage/2026/neu.txt', 'ls Ablage/2026'] },
    { id: 'rechte1', tab: 'term', title: 'Rechte lesen und mit chmod ändern', text: 'ls -l zeigt Typ und Rechte (rwx für Besitzer, Gruppe, andere). chmod ändert sie, oktal (750) oder symbolisch (u+x, g-w).', cmds: ['cd Projekt', 'ls -l backup.sh', './backup.sh', 'chmod 750 backup.sh', 'ls -l backup.sh', './backup.sh', 'chmod g-x,o+r backup.sh', 'ls -l backup.sh'] },
    { id: 'text1', tab: 'term', title: 'Dateien lesen: cat, head, tail, wc', text: 'cat gibt eine Datei aus, head und tail den Anfang und das Ende, wc -l zählt Zeilen, cat -n nummeriert.', cmds: ['cd Projekt', 'cat README.md', 'head -n 3 daten.csv', 'tail -n 2 daten.csv', 'wc -l daten.csv', 'cat -n ../notizen.txt'] },
    { id: 'pipe1', tab: 'term', title: 'Pipes: grep, sort, uniq, cut zusammenstecken', text: 'Mit | gibst du die Ausgabe eines Befehls an den nächsten weiter. So wird aus kleinen Werkzeugen eine Auswertung.', cmds: ["grep -c ' 404 ' /var/log/nginx/access.log", "grep ' 404 ' /var/log/nginx/access.log | wc -l", "cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -n 3"] },
    { id: 'umleit1', tab: 'term', title: 'Umleitung: > überschreibt, >> hängt an, 2> fängt Fehler', text: '> schreibt die Ausgabe in eine Datei, >> hängt an, 2> leitet nur Fehlermeldungen um. /dev/null verschluckt alles.', cmds: ['echo "Zeile 1" > liste.txt', 'echo "Zeile 2" >> liste.txt', 'cat liste.txt', 'ls gibtesnicht 2> fehler.txt', 'cat fehler.txt', 'ls gibtesnicht 2> /dev/null'] },
    { id: 'proz1', tab: 'term', title: 'Prozesse ansehen und beenden', text: 'ps aux listet Prozesse, mit grep filterst du. & startet im Hintergrund, jobs zeigt sie, kill beendet. Erst kill PID, nur wenn nötig kill -9 PID.', cmds: ['ps aux | grep python', 'kill 2417', 'ps aux | grep python', 'sleep 300 &', 'jobs', 'kill %1', 'jobs'] },
    { id: 'sudo1', tab: 'term', title: 'sudo und apt: Programme installieren', text: 'Für Systemänderungen brauchst du Administratorrechte: sudo davor. apt installiert Pakete. Ohne sudo meldet apt einen Fehler.', cmds: ['whoami', 'tree', 'apt install tree', 'sudo apt install -y tree', 'tree ~/Projekt', 'sudo whoami'] },
    { id: 'netz1', tab: 'term', title: 'Netzwerk: ip a, ping, ss', text: 'ip a zeigt Adressen, ping prüft die Erreichbarkeit (-c begrenzt die Pakete), ss -tuln zeigt lauschende Ports.', cmds: ['ip -br a', 'ip r', 'ping -c 2 192.168.10.1', 'ping -c 2 192.168.10.99', 'ss -tuln'] },
    { id: 'log1', tab: 'term', title: 'Logdateien lesen', text: 'Protokolle liegen unter /var/log. Manche darf nur root oder die Gruppe adm lesen. tail zeigt das Neueste, grep filtert.', cmds: ['ls -l /var/log', 'tail -n 3 /var/log/auth.log', 'sudo tail -n 3 /var/log/auth.log', "sudo grep -c 'Failed password' /var/log/auth.log"] },
    { id: 'skript1', tab: 'term', title: 'Ein Skript lesen und starten', text: 'Skripte liest du mit cat. Die erste Zeile (#!/bin/bash) nennt den Interpreter. Starten geht nur mit Ausführungsrecht. (Im Lab laufen Skripte als Simulation.)', cmds: ['cd Projekt', 'cat backup.sh', './backup.sh', 'chmod u+x backup.sh', './backup.sh', 'cat zaehle.sh'] },
    { id: 'cron1', tab: 'cron', title: 'Cron: Zeitangaben lesen', text: 'Fünf Felder: Minute, Stunde, Tag des Monats, Monat, Wochentag. * heißt jeder, */n alle n, a-b Bereich, a,b Liste.', p: { expr: '*/15 8-17 * * 1-5' } },
    { id: 'cron2', tab: 'cron', title: 'Cron: Backup jede Nacht um 02:30', text: '30 2 * * * bedeutet Minute 30, Stunde 2, an jedem Tag. Die Zeile steht in der crontab (crontab -l zeigt sie, crontab -e bearbeitet sie).', p: { expr: '30 2 * * *' } },
    { id: 'chmod1', tab: 'rechte', title: 'chmod 754: wer darf was?', text: '7 = rwx (Besitzer), 5 = r-x (Gruppe), 4 = r-- (andere). Im Rechner siehst du die Zahl, die Buchstabenfolge und den Befehl.', p: { mode: '754' } }
  ];

  root.LIN_DATA = { cats: CATS, tasks, gens: G, make, makeTask, randomQ, examples, image, facts: FACTS, runSolution, runWrong, stdSpec, term: TERM };
  root.LIN_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.LIN_DATA, TASKS: root.LIN_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
