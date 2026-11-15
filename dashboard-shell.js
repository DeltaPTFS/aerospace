
/* AeroScope ONE dashboard shell. UI-only layer: existing radar, APIs, accounts
   and aircraft details continue to be owned by the original app. */
(function(){
  'use strict';
  const byId = id => document.getElementById(id);
  const originalHeader=document.querySelector('body > header');
  const originalNav=document.querySelector('body > nav');
  const regionBar=byId('world-region-bar');
  const mapEl=byId('map'),status=byId('status'),panel=byId('panel'),other=byId('other');
  const footer=document.querySelector('body > footer');
  if(!originalHeader||!originalNav||!regionBar||!mapEl||!status||!panel||!other)return;

  const ico={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    radar:'<circle cx="12" cy="12" r="9"/><path d="M12 12 18 7"/><circle cx="12" cy="12" r="2"/>',
    flights:'<path d="m21 3-6.8 18-3.4-8-8-3.4L21 3Z"/><path d="m10.8 13.2-4.6 4.6"/>',
    airports:'<path d="M8 21V8l4-5 4 5v13M4 21h16M5 10h14M8 16h8"/>',
    alerts:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    atc:'<path d="M12 21V11M8 21h8M7 8a7 7 0 0 1 10 0M4 5a11 11 0 0 1 16 0"/><circle cx="12" cy="9" r="2"/>',
    camera:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    community:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM17 6a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
    premium:'<path d="m2 7 5 5 5-8 5 8 5-5-2 13H4L2 7Z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 2 1 3-1 2 4-3 2v2l3 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 3-2v-2L2 9l2-4 3 1 2-1 1-3Z"/>'
  };
  const shell=document.createElement('div');shell.id='aero-shell';
  const side=document.createElement('aside');side.id='aero-sidebar';side.setAttribute('aria-label','Main navigation');
  const main=document.createElement('div');main.id='aero-workspace';
  const content=document.createElement('div');content.id='aero-dashboard';
  const summary=document.createElement('section');summary.id='aero-summary';summary.setAttribute('aria-label','Live radar summary');
  summary.innerHTML=
    '<article class="aero-stat"><span class="ico">✈</span><span class="label">Recent aircraft sampled</span><strong id="aero-stat-aircraft" class="value">—</strong><span class="note">Current feed, not worldwide total</span></article>'+
    '<article class="aero-stat"><span class="ico">⌖</span><span class="label">Reference airports</span><strong id="aero-stat-ports" class="value">—</strong><span class="note">Airport markers available on map</span></article>'+
    '<article class="aero-stat"><span class="ico">◉</span><span class="label">Receiver coverage</span><strong id="aero-stat-feed" class="value">Connecting</strong><span class="note">Varies by region and provider</span></article>'+
    '<article class="aero-stat"><span class="ico">↻</span><span class="label">Last successful sample</span><strong id="aero-stat-update" class="value">—</strong><span class="note">Updates depend on feed availability</span></article>';
  const title=document.createElement('div');title.className='aero-top-title';
  title.innerHTML='<h1>Live Map <span class="aero-live-pill">◉ GLOBAL BETA</span></h1><p>Explore recent aircraft reports, flight routes, airports and airspace</p>';
  const mobile=document.createElement('button');mobile.className='aero-mobile-toggle';mobile.type='button';mobile.textContent='☰';mobile.setAttribute('aria-label','Toggle navigation');mobile.setAttribute('aria-expanded','false');
  mobile.onclick=()=>{document.body.classList.toggle('aero-menu-open');mobile.setAttribute('aria-expanded',String(document.body.classList.contains('aero-menu-open')))};
  const brand=originalHeader.querySelector('.brand');
  if(brand){side.append(brand);const cap=document.createElement('div');cap.className='aero-brand-caption';cap.textContent='AVIATION • TRACKING • COMMUNITY';brand.append(cap)}
  originalHeader.prepend(mobile,title);
  const sideLabel=document.createElement('div');sideLabel.className='aero-sidebar-label';sideLabel.textContent='Explore';
  side.append(sideLabel);
  const nav=document.createElement('div');nav.className='aero-menu';
  const entries=[['dashboard','Dashboard'],['radar','Live Map'],['flights','Flights'],['airports','Airports'],['alerts','Alerts'],['atc','ATC Recordings'],['camera','Airport Cameras'],['community','Community'],['premium','Premium'],['settings','Settings']];
  entries.forEach(([id,label],index)=>{
    if(index===5||index===7||index===9){const div=document.createElement('div');div.className='aero-side-divider';nav.append(div)}
    const btn=document.createElement('button');btn.type='button';btn.className='aero-side-link'+(id==='radar'?' is-current':'');btn.dataset.aeroSection=id;btn.setAttribute('aria-label',label);
    btn.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24">'+ico[id]+'</svg><span>'+label+'</span>';
    nav.append(btn);
    btn.onclick=()=>go(id);
  });
  side.append(nav);
  const bottom=document.createElement('div');bottom.className='aero-side-bottom';
  bottom.innerHTML='<div class="aero-premium-box"><strong>✧ AeroScope ONE</strong><p>Your aviation command center. Premium memberships are being planned, not sold yet.</p><a href="/profile">View my account →</a></div>';
  side.append(bottom);

  const overviewTitle=document.createElement('div');overviewTitle.className='aero-overview-title';
  overviewTitle.innerHTML='<h2>Aviation overview</h2><small>Real reports • Sampled coverage</small>';
  const controlsTitle=document.createElement('div');controlsTitle.className='aero-controls-title';
  controlsTitle.innerHTML='<h2>Explore airspace</h2><span>Switch views or choose a region</span>';
  originalNav.id='aero-native-nav';
  const grid=document.createElement('div');grid.id='aero-main-grid';
  const mainColumn=document.createElement('div');mainColumn.id='aero-main-column';
  const mapCard=document.createElement('section');mapCard.id='aero-map-card';
  const mapTitle=document.createElement('div');mapTitle.className='aero-map-topline';
  mapTitle.innerHTML='<h3>✈ Flight Radar</h3><small>Worldwide sampling · Select an aircraft for details</small>';
  const detailsCard=document.createElement('aside');detailsCard.id='aero-flight-card';
  const detailsTitle=document.createElement('div');detailsTitle.className='aero-flight-topline';
  detailsTitle.innerHTML='<h3>Selected aircraft</h3><small>Flight details</small>';
  mapCard.append(mapTitle,regionBar,mapEl,status);
  detailsCard.append(detailsTitle,panel);
  mainColumn.append(mapCard,other);
  grid.append(mainColumn,detailsCard);

  const lower=document.createElement('section');lower.className='aero-bottom-grid';
  lower.innerHTML=
    '<article class="aero-bottom-card" id="aero-recent"><h3>✈ Recent flights in the feed</h3><div id="aero-flight-rows" class="aero-rows"><p class="aero-empty">Waiting for aircraft reports…</p></div></article>'+
    '<article class="aero-bottom-card"><h3>◉ Network & coverage</h3><p id="aero-coverage-text">Flight positions are based on public receiver reports. Loading the latest regional sample.</p><p><small>Global overview is a limited sample, not all aircraft worldwide. Regions may have gaps or rate limits.</small></p></article>'+
    '<article class="aero-bottom-card" id="aero-community"><h3>♧ AeroScope community</h3><p>Discuss aviation, share discoveries and follow project updates. Discord integration is planned; no Discord server is linked here yet.</p><p id="aero-premium-note">Premium account features are being developed.</p><a href="/profile">Manage your AeroScope account</a></article>';
  content.append(overviewTitle,summary,controlsTitle,originalNav,grid,lower);
  shell.append(side,main);
  document.body.prepend(shell);
  main.append(originalHeader,content);
  if(footer)main.append(footer);

  function setCurrent(id){nav.querySelectorAll('.aero-side-link').forEach(b=>b.classList.toggle('is-current',b.dataset.aeroSection===id))}
  function ensureRadar(){const b=originalNav.querySelector('[data-tab="radar"]');if(b&&!b.classList.contains('active'))b.click();document.body.classList.remove('aero-nonradar');try{map.resize()}catch{}}
  function go(id){
    document.body.classList.remove('aero-menu-open');
    mobile.setAttribute('aria-expanded','false');
    if(id==='settings'||id==='alerts'){location.href='/profile';return}
    if(id==='atc'||id==='camera'){const b=originalNav.querySelector('[data-tab="'+(id==='atc'?'atc':'cams')+'"]');if(b)b.click();setCurrent(id);return}
    if(id==='community'||id==='premium'){
      document.body.classList.remove('aero-nonradar');ensureRadar();
      byId('aero-community').scrollIntoView({behavior:'smooth',block:'center'});setCurrent(id);return;
    }
    ensureRadar();setCurrent(id);
    if(id==='dashboard'){content.scrollIntoView({behavior:'smooth',block:'start'});}
    if(id==='radar'){mapCard.scrollIntoView({behavior:'smooth',block:'center'});}
    if(id==='flights'){mapCard.scrollIntoView({behavior:'smooth',block:'start'});byId('search').focus();}
    if(id==='airports'){mapCard.scrollIntoView({behavior:'smooth',block:'start'});byId('world-region-select').focus();}
  }
  originalNav.addEventListener('click',event=>{
    const tab=event.target.closest('[data-tab]');
    if(!tab)return;
    const isRadar=tab.dataset.tab==='radar';
    document.body.classList.toggle('aero-nonradar',!isRadar);
    if(!isRadar)setCurrent(tab.dataset.tab==='atc'?'atc':tab.dataset.tab==='cams'?'camera':'dashboard');
    else setCurrent('radar');
    if(isRadar)setTimeout(()=>{try{map.resize()}catch{}},70);
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.body.classList.contains('aero-menu-open')){
      document.body.classList.remove('aero-menu-open');mobile.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('click',e=>{
    if(window.innerWidth<=850&&document.body.classList.contains('aero-menu-open')&&!side.contains(e.target)&&e.target!==mobile){
      document.body.classList.remove('aero-menu-open');mobile.setAttribute('aria-expanded','false');
    }
  });
  const fresh=()=>typeof aircraft!=='undefined'&&Array.isArray(aircraft)?aircraft:[];
  const seen=()=>typeof lastLoadedAt!=='undefined'&&lastLoadedAt instanceof Date?lastLoadedAt:null;
  let lastFingerprint='';
  function update(){
    const planes=fresh(),last=seen();
    byId('aero-stat-aircraft').textContent=planes.length.toLocaleString();
    byId('aero-stat-ports').textContent=typeof airportList!=='undefined'&&Array.isArray(airportList)?String(airportList.length):'—';
    byId('aero-stat-update').textContent=last?last.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—';
    const hasRecentSample=!!last&&(Date.now()-last.getTime()<=180000);
    const error=/temporarily unavailable|HTTP|rate limit|budget reached/i.test(status.textContent||'');
    const health=hasRecentSample?(error?'Degraded':'Reporting'):(error?'Limited':'Connecting');
    byId('aero-stat-feed').textContent=health;
    byId('aero-coverage-text').textContent=error?'Current receiver requests are limited or unavailable in this area. Try another region or refresh later.':(hasRecentSample?'Recent receiver reports available for sampled regions. Zoom in for nearby coverage.':'Waiting for recent receiver reports. Coverage depends on the selected map region.');
    const slice=planes.filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon)).slice(0,6);
    const fingerprint=slice.map(a=>[a.hex,a.flight,a.alt_baro,a.gs].join(':')).join('|')+'-'+(last?last.getTime():0);
    if(fingerprint===lastFingerprint)return;
    lastFingerprint=fingerprint;
    const rows=byId('aero-flight-rows');rows.replaceChildren();
    if(!slice.length){const empty=document.createElement('p');empty.className='aero-empty';empty.textContent='No recent aircraft available in this sample. Change region or use Refresh.';rows.append(empty);return;}
    const head=document.createElement('div');head.className='aero-row aero-row-header';head.innerHTML='<span>Aircraft</span><span>Altitude</span><span>Speed</span>';rows.append(head);
    slice.forEach(a=>{
      const btn=document.createElement('button');btn.className='aero-row';btn.type='button';
      const flight=String(a.flight||a.r||a.hex||'Unknown').trim();
      const alt=a.alt_baro==='ground'?'Ground':Number.isFinite(a.alt_baro)?Math.round(a.alt_baro).toLocaleString()+' ft':'—';
      const spd=Number.isFinite(a.gs)?Math.round(a.gs)+' kt':'—';
      [flight,alt,spd].forEach((value,i)=>{const el=document.createElement(i?'span':'strong');el.textContent=value;btn.append(el)});
      btn.setAttribute('aria-label','View aircraft '+flight);
      btn.onclick=()=>{ensureRadar();try{map.flyTo({center:[a.lon,a.lat],zoom:Math.max(map.getZoom(),6),duration:550,essential:true})}catch{}try{details(a)}catch{}mapCard.scrollIntoView({behavior:'smooth',block:'center'})};
      rows.append(btn);
    });
  }
  const observer=new MutationObserver(()=>{window.requestAnimationFrame(update)});
  observer.observe(status,{childList:true,subtree:true,characterData:true});
  update();
  setInterval(update,30000);
  requestAnimationFrame(()=>{try{map.resize()}catch{}});
  setTimeout(()=>{try{map.resize()}catch{}},400);
})();
