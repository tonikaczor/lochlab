/* gate.js - gemeinsames Passwort-Tor aller Lab-Seiten (Stufe 1 Schlank, vorher 26-mal als HTML + Inline-Skript kopiert).
 * Einbindung: <script src="gate.js" data-title="Tonfunk ...-Lab"></script> zwischen <!--GATE--> und <!--/GATE--> (data-btn nur, wenn der Knopf nicht "btn pri" heisst).
 * Das Skript setzt das Tor (#gate) synchron vor sich in die Seite; Ablauf, Speicherschluessel (lm4.gate, lm4.name) und der Hash stehen nur noch hier.
 * Der Hash ist der SHA-256 des Passworts, kein Klartext. */
(function(){
  var H='a969a208b4df4a7c43c54c888590813046cf4c30f07efa9bb162c4aff6aabfba';
  var cs=document.currentScript;
  var T=(cs&&cs.getAttribute('data-title'))||'Tonfunk Lab',B=(cs&&cs.getAttribute('data-btn'))||'btn pri';
  var E=function(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');};
  var tpl='<div id="gate"><form id="gateForm" autocomplete="on">\n  <img src="logo.png" alt="Tonfunk" onerror="this.remove()">\n  <h1>@TITLE@</h1>\n  <p id="gateHint">Bitte anmelden</p>\n  <input id="gateName" type="text" placeholder="Vor- und Nachname" autocomplete="name" autocapitalize="words" autocorrect="off" spellcheck="false" aria-label="Name">\n  <input id="gatePw" type="password" placeholder="Passwort" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Passwort">\n  <button class="@BTN@" type="submit">Öffnen</button>\n  <div id="gateErr" role="alert"></div>\n</form></div>\n';
  var mk=tpl.replace('@TITLE@',E(T)).replace('@BTN@',E(B));
  if(cs&&cs.parentNode)cs.insertAdjacentHTML('beforebegin',mk);else document.body.insertAdjacentHTML('afterbegin',mk);
  var g=document.getElementById('gate');
  var pwOk=false,name='';
  try{pwOk=localStorage.getItem('lm4.gate')===H;name=localStorage.getItem('lm4.name')||'';}catch(e){}
  if(pwOk&&name){g.remove();return;}
  var f=document.getElementById('gateForm'),er=document.getElementById('gateErr'),pw=document.getElementById('gatePw'),nm=document.getElementById('gateName');
  nm.value=name;
  if(pwOk){pw.style.display='none';document.getElementById('gateHint').textContent='Bitte Namen eintragen';}
  async function sha(t){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}
  f.addEventListener('submit',async function(ev){
    ev.preventDefault();
    var n=nm.value.trim().replace(/\s+/g,' ');
    if(n.length<3||n.indexOf(' ')<0){er.textContent='Bitte Vor- und Nachnamen eintragen.';nm.focus();return;}
    if(!pwOk){
      if(!(window.crypto&&crypto.subtle)){er.textContent='Bitte die Seite über https öffnen.';return;}
      if(await sha(pw.value.trim())!==H){er.textContent='Passwort falsch.';pw.select();return;}
      try{localStorage.setItem('lm4.gate',H);}catch(_){}
    }
    try{localStorage.setItem('lm4.name',n);}catch(_){}
    g.remove();
  });
})();
