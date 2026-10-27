/* AeroScope ONE v0.4 enhancements — satellite imagery, flight tools, safe ATC directory */
(()=>{
// Single global imagery source prevents opaque missing USGS overlay tiles from creating black checkerboards.
// For commercial launch, confirm Esri imagery usage rights or switch to a licensed provider.
const satelliteStyle={version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:18,attribution:'Imagery © Esri and imagery contributors • historical, not live'}},layers:[{id:'global-imagery',type:'raster',source:'imagery'}]};
let satellite=false;
const mapButton=document.createElement('button');mapButton.id='map-mode';mapButton.className='';mapButton.textContent='🗺 Streets';mapButton.title='Switch between satellite and streets';document.getElementById('toolbar').appendChild(mapButton);
function applyStyle(){const center=map.getCenter(),zoom=map.getZoom(),bearing=map.getBearing(),pitch=map.getPitch();map.setStyle(satellite?satelliteStyle:'https://tiles.openfreemap.org/styles/liberty');map.once('style.load',()=>{map.jumpTo({center,zoom,bearing,pitch});map.resize();});mapButton.textContent=satellite?'🛰 Satellite':'🗺 Streets';mapButton.classList.toggle('active',satellite);}
mapButton.onclick=()=>{satellite=!satellite;applyStyle();};
// Keep the lightweight vector basemap by default, especially on phones.
const info=document.createElement('div');info.className='flight-note';info.textContent='AERIAL / SATELLITE • Esri World Imagery and contributors. Historical imagery, not live; tile coverage and image dates vary.';document.getElementById('map').appendChild(info);
const oldNav=document.querySelector('nav');
const locate=document.createElement('button');
locate.textContent='⌖ My Location';locate.title='Opt in to a moving location dot on this device. Nothing is stored or sent to an account.';
const clearLoc=document.createElement('button');clearLoc.type='button';clearLoc.textContent='✕ Stop Location';clearLoc.hidden=true;
let userMarker=null,watchId=null,centered=false;
const locationMessage=msg=>{const status=document.getElementById('status');if(status)status.textContent=msg};
function stopLocalLocation(){
 if(watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(watchId);watchId=null}
 if(userMarker){userMarker.remove();userMarker=null}
 centered=false;clearLoc.hidden=true;locate.disabled=false;locate.textContent='⌖ My Location';
}
clearLoc.onclick=()=>{stopLocalLocation();locationMessage('On-device location display stopped; the marker and its coordinates are no longer held by the page.')};
locate.onclick=()=>{
 if(!navigator.geolocation){locationMessage('Location is unavailable in this browser');return}
 if(watchId!==null){clearLoc.onclick();return}
 locate.disabled=true;locate.textContent='Requesting location…';
 watchId=navigator.geolocation.watchPosition(p=>{
  if(!Number.isFinite(p.coords.longitude)||!Number.isFinite(p.coords.latitude))return;
  const coords=[p.coords.longitude,p.coords.latitude];
  if(!userMarker){
   const dot=document.createElement('div');
   dot.style.cssText='width:17px;height:17px;border-radius:50%;background:#197af5;border:3px solid #fff;box-shadow:0 0 0 7px #197af544,0 2px 8px #0018';
   userMarker=new maplibregl.Marker({element:dot}).setLngLat(coords).addTo(map);
  }else userMarker.setLngLat(coords);
  userMarker.setPopup(new maplibregl.Popup().setText('Your browser-reported location (±'+Math.round(p.coords.accuracy||0)+' m). Only displayed on this device while you have opted in.'));
  if(!centered){centered=true;map.flyTo({center:coords,zoom:11})}
  clearLoc.hidden=false;locate.disabled=false;locate.textContent='⌖ Location On';
  locationMessage('On-device location marker active (±'+Math.round(p.coords.accuracy||0)+' m). Use Stop Location to turn it off.');
 },e=>{
  if(e?.code===1||!userMarker){stopLocalLocation();locationMessage(e?.code===1?'Location permission was declined. AeroScope does not require location.':'Location temporarily unavailable. You can try again.')}
 },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&watchId!==null)stopLocalLocation()});
window.addEventListener('pagehide',stopLocalLocation);
oldNav.appendChild(locate);oldNav.appendChild(clearLoc);
// Exact coordinates stay in this tab's marker only. Regional flight lookup uses coarse-rounded map coordinates.
document.querySelector('[data-tab="window"]').addEventListener('click',()=>{setTimeout(()=>{const o=document.getElementById('other');o.innerHTML='<h2>🪟 Passenger Window Simulator</h2><p>Animated artistic simulation — not a real plane camera or flight-position renderer.</p><div class="window-controls"><button id="daymode" class="active">Day</button><button id="nightmode">Night</button><button id="cloudmode">Cloudy</button></div><div id="sky-view" class="sky day"><div class="sun"></div><div class="cloud cloud1"></div><div class="cloud cloud2"></div><div class="wing"></div></div><small>Window simulation moves independently of aircraft tracking.</small>';o.querySelector('#daymode').onclick=()=>setSky('day');o.querySelector('#nightmode').onclick=()=>setSky('night');o.querySelector('#cloudmode').onclick=()=>setSky('cloudy');function setSky(v){o.querySelector('#sky-view').className='sky '+v;o.querySelectorAll('.window-controls button').forEach(b=>b.classList.toggle('active',b.id===v+'mode'));}},0)});
document.querySelector('[data-tab="sim"]').addEventListener('click',()=>{setTimeout(()=>{const o=document.getElementById('other');const p=document.createElement('p');p.innerHTML='Practice target heading <b>270°</b> (west). Move the slider until you reach it.';o.appendChild(p);const b=document.createElement('button');b.textContent='Check heading';b.onclick=()=>{const v=Number(document.getElementById('h')?.value);alert(Math.abs(v-270)<=5?'Great job — on heading!':'Try again: west is 270 degrees.')};o.appendChild(b)},0)});
})();
