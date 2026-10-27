/* AeroScope ONE opt-in, in-session flight notifications.
 * No push token, account lookup, analytics, stored location or tracking profile.
 * In-app alerts work while the radar page is open. Background web push is NOT enabled.
 */
(()=>{
let enabled=false,toastTimer=null;
const previous=new Map(),lastAlert=new Map();
const button=document.createElement('button');
button.type='button';button.textContent='🔔 Alerts Off';button.title='Enable alerts for selected aircraft while this radar page remains open';
document.querySelector('nav')?.appendChild(button);
function toast(msg){
 const old=document.querySelector('.aero-toast');if(old)old.remove();
 const t=document.createElement('div');t.className='aero-toast';t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),5500);
}
function emit(label,message,hex){
 const key=hex+'|'+message;
 if(Date.now()-(lastAlert.get(key)||0)<180000)return;
 lastAlert.set(key,Date.now());
 toast(label+': '+message);
 if(typeof Notification==='function'&&Notification.permission==='granted'){
  try{new Notification(label,{body:message,tag:'aeroscope-'+hex,silent:true})}catch{}
 }
}
button.onclick=async()=>{
 if(enabled){enabled=false;previous.clear();button.classList.remove('active');button.textContent='🔔 Alerts Off';toast('In-session notifications are off.');return}
 enabled=true;button.textContent='🔔 Alerts On';button.classList.add('active');
 if(typeof Notification==='function'&&Notification.permission==='default'){
  try{await Notification.requestPermission()}catch{}
 }
 const platform=typeof Notification!=='function'||Notification.permission!=='granted';
 toast(platform?'In-page flight alerts enabled. System notifications require browser or Home Screen app support.':'Flight alerts enabled for the selected aircraft while AeroScope is open.');
};
const simpleStatus=a=>a?.alt_baro==='ground'?'ground':Number.isFinite(a?.alt_baro)?'airborne':'unknown';
function observe(a){
 if(!enabled||!a)return;
 const hex=String(a.hex||'').toLowerCase();
 if(!hex||hex!==String(window.AeroScopeSelectedHex?.()||'').toLowerCase())return;
 const emergency=String(a.emergency||'none').toLowerCase();
 const squawk=String(a.squawk||'');
 const status=simpleStatus(a);
 const prev=previous.get(hex);
 previous.set(hex,{status,emergency,squawk});
 if(!prev)return; // First reading establishes baseline; no false transition notification.
 const name=String(a.flight||hex).trim().toUpperCase();
 if((emergency!=='none'&&emergency!==prev.emergency)||(['7500','7600','7700'].includes(squawk)&&squawk!==prev.squawk)){
  emit(name,'Emergency-related transponder indication reported. Verify with an authoritative source.',hex);
 }else if(status!=='unknown'&&prev.status!=='unknown'&&status!==prev.status){
  emit(name,status==='ground'?'Aircraft reported on the ground.':'Aircraft reported airborne.',hex);
 }
}
window.AeroScopeAlerts={observe};
})();
