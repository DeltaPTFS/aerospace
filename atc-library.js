/* AeroScope-owned ATC player. Only licensed/owned audio is permitted.
   Free, emergency archive, and locked aircraft-specific Premium are separate. */
(()=>{
let active='free',filters={callsign:'',airport:''};
let records={free:[],emergencies:[],premiumCount:0};
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function clean(s){return String(s||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,18)}
function renderATIS(root,list){
 const c=el('section','atc-atis-panel');
 c.append(el('h3','','Airport ATIS & Weather'));
 c.append(el('p','','Airport information is different from live air traffic control conversations. ATIS Relay text is not an aircraft radio recording.'));
 const form=el('div','atc-atis-search');
 const input=el('input');
 input.type='text';input.inputMode='text';input.maxLength=4;input.placeholder='ICAO airport (KJFK)';input.setAttribute('aria-label','ICAO airport identifier');input.value=filters.airport.length===4?filters.airport:'KJFK';
 const button=el('button','','Get airport information');button.type='button';
 const result=el('div','atc-atis-result');result.setAttribute('role','status');
 form.append(input,button);c.append(form,result);
 const warning=el('p','atc-note','Unofficial. Not for operational use. Confirm on frequency. Audio is not included in the free ATIS Relay plan.');c.append(warning);
 const attribution=el('a','atc-atis-credit','Data: ATIS Relay');attribution.href='https://atisrelay.com/';attribution.target='_blank';attribution.rel='noopener noreferrer';c.append(attribution);
 const show=async()=>{
  const icao=clean(input.value);
  result.replaceChildren();
  if(!/^[A-Z0-9]{4}$/.test(icao)){result.append(el('p','','Enter a valid four-character airport code such as KJFK.'));return}
  button.disabled=true;result.append(el('p','','Checking availability of the ATIS data service…'));
  try{
   const r=await fetch('/api/atis-relay?icao='+encodeURIComponent(icao),{cache:'no-store'});
   if(!r.ok)throw Error('ATIS data request failed (HTTP '+r.status+').');
   const d=await r.json();
   if(!c.isConnected)return;
   result.replaceChildren();
   if(!d.available){
    result.append(el('h4','','ATIS Relay integration status'));
    result.append(el('p','',String(d.reason||'Airport information is not available.')));
    return;
   }
   result.append(el('h4','',(d.airport||icao)+' · Airport information'));
   const status=el('p','atc-meta','Checked '+new Date(d.checkedAt).toLocaleString()+' · Source: ATIS Relay');result.append(status);
   const add=(title,body)=>{
    if(!body)return;
    const section=el('section','atc-atis-message');
    section.append(el('strong','',title),el('p','',String(body)));
    result.append(section);
   };
   add('D-ATIS',d.atis?.text);
   add('Arrival ATIS',d.arrival?.text);
   add('Departure ATIS',d.departure?.text);
   add('Latest transcribed broadcast',d.transcript);
   add('METAR',d.metar);
   if(d.flightRules)add('Flight rules',d.flightRules);
   if(!d.atis?.text&&!d.arrival?.text&&!d.departure?.text&&!d.transcript&&!d.metar)add('No current information','The airport has no currently available report. Try again later.');
   result.append(el('p','atc-note',String(d.notice||'Unofficial. Not for operational use. Confirm on frequency.')));
  }catch(e){if(c.isConnected){result.replaceChildren();result.append(el('p','',e.message||'ATIS information temporarily unavailable.'))}}
  finally{if(c.isConnected)button.disabled=false}
 };
 button.onclick=show;input.addEventListener('keydown',e=>{if(e.key==='Enter')show()});
 list.append(c);
}
function renderList(root){
 const list=root.querySelector('#atc-recordings-list');if(!list)return;
 list.replaceChildren();
 root.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category===active));
 if(active==='atis'){renderATIS(root,list);return}
 if(active==='premium'){
  const c=el('div','atc-empty');
  c.append(el('h3','', '🔒 Aircraft-specific ATC — Premium (planned)'));
  c.append(el('p','','Recordings will only appear when their aircraft callsign and transmission times have been independently matched, audio rights are cleared, and a server verifies the listener’s subscription.'));
  c.append(el('p','','Premium purchases and playback are not yet enabled.'));
  list.append(c);return;
 }
 const source=active==='emergencies'?records.emergencies:records.free;
 const filtered=source.filter(x=>{
  const match=[x.title,x.airport,x.callsign,x.description].filter(Boolean).join(' ').toUpperCase();
  return (!filters.callsign||match.includes(filters.callsign))&&(!filters.airport||match.includes(filters.airport));
 });
 if(!filtered.length){
  const c=el('div','atc-empty');
  c.append(el('h3','',active==='emergencies'?'No licensed emergency recordings yet':'No licensed ATC recordings yet'));
  c.append(el('p','','The built-in player is ready. This section will display recordings once AeroScope owns or licenses them. Nothing is presented as real ATC without an actual authorized recording.'));
  list.append(c);return;
 }
 for(const x of filtered){
  const card=el('article','atc-clip');
  card.append(el('h3','',String(x.title||'ATC recording')));
  card.append(el('p','atc-meta',[x.airport,x.callsign,x.date,x.duration].filter(Boolean).join(' • ')));
  if(x.description)card.append(el('p','',String(x.description)));
  const button=el('button','atc-play','▶ Play recording');button.type='button';
  button.onclick=()=>{
   const src=String(x.audioUrl||'');
   // Same-origin authorized audio only; never embed third-party or premium URLs.
   if(!/^\/atc-audio\/[A-Za-z0-9_.-]+\.(mp3|ogg|m4a|wav)$/i.test(src)){button.textContent='Recording unavailable';return}
   const audio=root.querySelector('#atc-player');
   const label=root.querySelector('#atc-now-playing');
   audio.pause();audio.src=src;audio.hidden=false;audio.load();
   label.textContent='Playing: '+String(x.title||'ATC recording');
   audio.play().catch(()=>{});
  };
  card.append(button);
  if(x.credit)card.append(el('p','atc-credit','Audio source/licensing: '+x.credit));
  list.append(card);
 }
}
async function showATC(root){
 if(!root)return;
 root.replaceChildren();
 const box=el('section','atc-library');
 box.innerHTML='<div class="atc-intro"><span class="atc-eyebrow">AEROSCOPE ONE™ AUDIO</span><h2>ATC Recordings</h2><p>Listen to rights-cleared aviation radio recordings without leaving AeroScope. We never replay third-party feeds without permission.</p></div><div class="atc-categories"><button type="button" data-category="free" class="active">🎧 Free ATC</button><button type="button" data-category="emergencies">🚨 Emergency Archive</button><button type="button" data-category="atis">☁ Airport ATIS</button><button type="button" data-category="premium">🔒 Aircraft Premium</button></div><div class="atc-search"><label>Flight callsign<input id="atc-callsign" placeholder="e.g. DAL123" autocomplete="off"></label><label>Airport code<input id="atc-airport-filter" placeholder="e.g. KJFK" autocomplete="off"></label></div><p id="atc-library-note" class="atc-note">Checking licensed recording catalog…</p><div id="atc-recordings-list"></div><div class="atc-player-box"><strong id="atc-now-playing">No recording selected</strong><audio id="atc-player" controls preload="none" hidden></audio><small>All available recordings play inside AeroScope. This archive is not a live radio service.</small></div><p class="atc-footer-note">Airport radio can include many aircraft. A recording is assigned to a specific flight only after callsign, time, and source verification. Emergency labels must also be independently confirmed.</p>';
 root.append(box);
 box.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{active=b.dataset.category;renderList(box)});
 box.querySelector('#atc-callsign').oninput=e=>{filters.callsign=clean(e.target.value);renderList(box)};
 box.querySelector('#atc-airport-filter').oninput=e=>{filters.airport=clean(e.target.value);renderList(box)};
 renderList(box);
 try{
  const response=await fetch('/api/atc-recordings',{cache:'no-store'});
  if(!response.ok)throw new Error('catalog');
  const data=await response.json();
  if(!box.isConnected)return;
  records={free:Array.isArray(data.free)?data.free:[],emergencies:Array.isArray(data.emergencies)?data.emergencies:[],premiumCount:Number(data.premiumCount)||0};
  box.querySelector('#atc-library-note').textContent='Only owned or licensed recordings are published here; no external links or audio re-streaming.';
  renderList(box);
 }catch{
  if(box.isConnected)box.querySelector('#atc-library-note').textContent='Recording library unavailable. Try again later.';
 }
}
window.AeroScopeATC={show:showATC};
})();
