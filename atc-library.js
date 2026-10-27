/* AeroScope-owned ATC player. Only licensed/owned audio is permitted.
   Free, emergency archive, and locked aircraft-specific Premium are separate. */
(()=>{
let active='free',filters={callsign:'',airport:''};
let records={free:[],emergencies:[],premiumCount:0};
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function clean(s){return String(s||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,18)}
function renderList(root){
 const list=root.querySelector('#atc-recordings-list');if(!list)return;
 list.replaceChildren();
 root.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category===active));
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
 box.innerHTML='<div class="atc-intro"><span class="atc-eyebrow">AEROSCOPE ONE™ AUDIO</span><h2>ATC Recordings</h2><p>Listen to rights-cleared aviation radio recordings without leaving AeroScope. We never replay third-party feeds without permission.</p></div><div class="atc-categories"><button type="button" data-category="free" class="active">🎧 Free ATC</button><button type="button" data-category="emergencies">🚨 Emergency Archive</button><button type="button" data-category="premium">🔒 Aircraft Premium</button></div><div class="atc-search"><label>Flight callsign<input id="atc-callsign" placeholder="e.g. DAL123" autocomplete="off"></label><label>Airport code<input id="atc-airport-filter" placeholder="e.g. KJFK" autocomplete="off"></label></div><p id="atc-library-note" class="atc-note">Checking licensed recording catalog…</p><div id="atc-recordings-list"></div><div class="atc-player-box"><strong id="atc-now-playing">No recording selected</strong><audio id="atc-player" controls preload="none" hidden></audio><small>All available recordings play inside AeroScope. This archive is not a live radio service.</small></div><p class="atc-footer-note">Airport radio can include many aircraft. A recording is assigned to a specific flight only after callsign, time, and source verification. Emergency labels must also be independently confirmed.</p>';
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
