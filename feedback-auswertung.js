'use strict';
/* Tonfunk Lab: Auswertung der Aufgaben-Rückmeldungen (feedback-auswertung.html).
   Zeigt die Rückmeldungen dieses Geräts (lm4.fb) und, wenn gewünscht, zusätzlich eingelesene Dateien anderer Geräte. Alles bleibt in diesem Browser. */
(function () {
  const F = window.Feedback; if (!F) return;
  const $ = s => document.querySelector(s);
  const rows = window.AUFGABEN || [], LABS = window.AUFGABEN_LABS || {};
  const titel = {}; rows.forEach(r => { titel[r[0]] = r[3]; });
  let eigene = [], fremde = [], sort = 'problem', nurAuffaellig = false;
  const lesen = () => { try { return F.liste(JSON.parse(localStorage.getItem(F.KEY))); } catch (e) { return []; } };
  const alle = () => F.zusammen(eigene, fremde);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const labName = k => LABS[k] || k;

  function datei(name, text, typ) {
    const a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: typ }));
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  const meldung = (t, ok) => { const m = $('#msg'); m.textContent = t; m.className = ok ? 'ok' : 'no'; };

  function render() {
    const recs = alle(), s = F.summe(recs);
    $('#sum').textContent = s.n ? s.n + ' Rückmeldungen zu ' + s.aufgaben + ' Aufgaben: ' + s.leicht + ' zu leicht, ' + s.passt + ' passt, ' + s.schwer + ' zu schwer, ' + s.unklar + ' unklar.' : 'Noch keine Rückmeldungen vorhanden.';
    $('#src').textContent = 'Dieses Gerät: ' + eigene.length + ' · aus Dateien: ' + F.zusammen(fremde).length;
    ['#expJson', '#expCsv'].forEach(i => { $(i).disabled = !s.n; });
    let a = F.aggregiere(recs, id => titel[id] || '');
    if (nurAuffaellig) a = a.filter(r => r.flags.length);
    if (sort === 'n') a = a.slice().sort((x, y) => y.n - x.n || (x.id < y.id ? -1 : 1));
    else if (sort === 'unklar') a = a.slice().sort((x, y) => y.unklar - x.unklar || y.n - x.n || (x.id < y.id ? -1 : 1));
    else if (sort === 'schwer') a = a.slice().sort((x, y) => y.schwer - x.schwer || y.n - x.n || (x.id < y.id ? -1 : 1));
    const body = $('#rows'); body.textContent = '';
    a.forEach(r => {
      const tr = document.createElement('tr');
      const c1 = el('td'); c1.appendChild(el('b', r.titel || r.id)); c1.appendChild(el('div', labName(r.lab) + ' · ' + r.id, 'mute')); tr.appendChild(c1);
      [r.n, r.leicht, r.passt, r.schwer, r.unklar].forEach(n => tr.appendChild(el('td', n, 'z')));
      tr.appendChild(el('td', r.flags.join(', ') || '', r.flags.length ? 'flag' : ''));
      body.appendChild(tr);
    });
    $('#empty').hidden = a.length > 0;
    $('#tbl').hidden = !a.length;
  }

  function init() {
    eigene = lesen(); render();
    $('#expJson').onclick = () => { datei('tonfunk-rueckmeldungen-' + F.tag(Date.now()) + '.json', F.zuJson(alle()), 'application/json'); meldung('JSON-Datei gespeichert.', true); };
    $('#expCsv').onclick = () => { datei('tonfunk-rueckmeldungen-' + F.tag(Date.now()) + '.csv', F.zuCsv(alle()), 'text/csv;charset=utf-8'); meldung('CSV-Datei gespeichert (Semikolon, für Excel).', true); };
    $('#pick').onchange = e => {
      const fs = Array.prototype.slice.call(e.target.files || []); if (!fs.length) return;
      let fertig = 0, ok = 0, fehler = [];
      fs.forEach(f => {
        const rd = new FileReader();
        rd.onload = () => { try { fremde = F.zusammen(fremde, F.leseJson(String(rd.result))); ok++; } catch (x) { fehler.push(f.name + ': ' + x.message); } done(); };
        rd.onerror = () => { fehler.push(f.name + ': nicht lesbar'); done(); };
        rd.readAsText(f);
      });
      function done() { if (++fertig < fs.length) return; render(); e.target.value = ''; meldung(ok + ' Datei(en) eingelesen.' + (fehler.length ? ' Probleme: ' + fehler.join('; ') : ''), !fehler.length); }
    };
    $('#clearIn').onclick = () => { fremde = []; render(); meldung('Eingelesene Dateien entfernt.', true); };
    $('#sort').onchange = e => { sort = e.target.value; render(); };
    $('#onlyFlag').onchange = e => { nurAuffaellig = e.target.checked; render(); };
    $('#clearOwn').onclick = () => {
      if (!eigene.length) { meldung('Auf diesem Gerät sind keine Rückmeldungen gespeichert.', false); return; }
      if (!window.confirm('Die ' + eigene.length + ' Rückmeldungen auf diesem Gerät wirklich löschen? Das lässt sich nicht rückgängig machen. Exportiere sie vorher, wenn du sie brauchst.')) return;
      try { localStorage.removeItem(F.KEY); } catch (e) {} eigene = []; render(); meldung('Rückmeldungen dieses Geräts gelöscht.', true);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
